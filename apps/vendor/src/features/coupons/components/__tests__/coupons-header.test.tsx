import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// The header is a title and one way in. It used to carry a "More actions"
// menu with "Export coupons" and "Import CSV", neither wired to anything —
// the API has no coupon CSV operation — and a dead item reads as a broken
// one. What this pins is that the menu stays gone until there is something
// for it to do, and that the one action left still opens the type picker.

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ shopSlug: "acme" }),
}))

// The title, the button and the dialog behind it all read from the `coupons`
// namespace now, so the mock translates against `en.json` for real.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { CouponsHeader } from "../list/coupons-header"

describe("CouponsHeader", () => {
  beforeEach(() => {
    push.mockClear()
  })

  it("offers Create coupon and nothing that goes nowhere", () => {
    render(<CouponsHeader />)
    expect(screen.getByRole("button", { name: "Create coupon" })).toBeDefined()
    expect(screen.queryByText("More actions")).toBeNull()
    expect(screen.queryByText("Export coupons")).toBeNull()
    expect(screen.queryByText("Import CSV")).toBeNull()
  })

  it("opens the type picker from Create coupon", () => {
    render(<CouponsHeader />)
    fireEvent.click(screen.getByRole("button", { name: "Create coupon" }))
    expect(screen.getByText("Select coupon type")).toBeDefined()
  })
})
