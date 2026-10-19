import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// The mirror of `CreateProductDialog`, and it has the same one job: turning a
// choice into the right create URL. What is worth pinning after the i18n move
// is that the four rows still read as coupon types rather than as the enum
// tokens they are now keyed by — `COUPON_TYPE_META` carries no copy at all, so
// a row whose message key is missing renders nothing a merchant can act on.

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ shopSlug: "acme" }),
}))

// Real messages rather than a key echo: the labels below are the assertion.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { Button } from "@repo/ui/components/button"
import { CreateCouponDialog } from "../list/create-coupon-dialog"

function openDialog() {
  render(<CreateCouponDialog trigger={<Button>Create coupon</Button>} />)
  fireEvent.click(screen.getByRole("button", { name: "Create coupon" }))
}

describe("CreateCouponDialog", () => {
  beforeEach(() => {
    push.mockClear()
  })

  it("lists every coupon type with its description", () => {
    openDialog()
    expect(screen.getByText("Select coupon type")).toBeDefined()
    expect(screen.getByText("Amount off products")).toBeDefined()
    expect(screen.getByText("Buy X get Y")).toBeDefined()
    expect(screen.getByText("Amount off order")).toBeDefined()
    expect(screen.getByText("Free shipping")).toBeDefined()
    expect(screen.getByText("Discount the total order amount")).toBeDefined()
  })

  it.each([
    ["Amount off products", "amount_off_products"],
    ["Buy X get Y", "buy_x_get_y"],
    ["Amount off order", "amount_off_order"],
    ["Free shipping", "free_shipping"],
  ])("routes %s to /coupons/new/%s", (label, type) => {
    openDialog()
    fireEvent.click(screen.getByText(label))
    expect(push).toHaveBeenCalledWith(`/store/acme/coupons/new/${type}`)
  })

  it("closes on Cancel without routing anywhere", () => {
    openDialog()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(push).not.toHaveBeenCalled()
  })
})
