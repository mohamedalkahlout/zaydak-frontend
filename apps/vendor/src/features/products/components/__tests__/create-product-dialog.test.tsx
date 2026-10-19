import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// What this pins is the dialog's only real job: turning a choice into the
// right create-form URL. The `?kind=` it appends is what seeds the form
// (`productFormDefaults`), so a wrong token here silently hands every
// merchant a physical simple product.

const push = vi.fn()
const prefetch = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch }),
  useParams: () => ({ shopSlug: "acme" }),
}))

// Every row's label and description now comes from `products.kinds.<ENUM>`,
// so the mock translates for real: the assertions below are the English a
// merchant reads, and a key missing from `en.json` fails them.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { Button } from "@repo/ui/components/button"
import { CreateProductDialog } from "../list/create-product-dialog"

function openDialog() {
  render(
    <CreateProductDialog trigger={<Button>Add product</Button>} />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Add product" }))
}

describe("CreateProductDialog", () => {
  beforeEach(() => {
    push.mockClear()
    prefetch.mockClear()
  })

  it("lists every kind with its description", () => {
    openDialog()
    expect(screen.getByText("What kind of product?")).toBeDefined()
    expect(screen.getByText("Simple product")).toBeDefined()
    expect(screen.getByText("Product with options")).toBeDefined()
    expect(screen.getByText("Service")).toBeDefined()
    // D12: digital create is out of V1.
    expect(screen.queryByText("Digital product")).toBeNull()
  })

  // The badge is a `badge: true` flag on one row of `PRODUCT_KIND_META` and
  // its wording lives in the message catalogue, so nothing but SIMPLE can
  // grow one by accident.
  it("pills only the default kind as the most common one", () => {
    openDialog()
    const badge = screen.getByText("Most common")
    expect(badge).toBeDefined()
    expect(screen.getAllByText("Most common")).toHaveLength(1)
    expect(badge.closest("button")?.getAttribute("data-kind")).toBe("SIMPLE")
  })

  it.each([
    ["Simple product", "simple"],
    ["Product with options", "variable"],
    ["Service", "service"],
    ["Assembled product", "assembled"],
  ])("routes %s to ?kind=%s", (label, param) => {
    openDialog()
    fireEvent.click(screen.getByText(label))
    expect(push).toHaveBeenCalledWith(
      `/store/acme/products/new?kind=${param}`,
    )
  })

  it("warms the create route on hover so the form opens on fields", () => {
    openDialog()
    fireEvent.mouseEnter(screen.getByText("Service"))
    expect(prefetch).toHaveBeenCalledWith("/store/acme/products/new?kind=service")
    expect(push).not.toHaveBeenCalled()
  })

  it("moves focus between rows with the arrow keys", () => {
    openDialog()
    const rows = screen
      .getAllByRole("button")
      .filter((el) => el.hasAttribute("data-kind"))
    // SIMPLE + VARIABLE + SERVICE (DIGITAL omitted for D12).
    expect(rows).toHaveLength(3)

    rows[0].focus()
    fireEvent.keyDown(rows[0], { key: "ArrowDown" })
    expect(document.activeElement).toBe(rows[1])

    // Wraps around the end of the list rather than dead-ending.
    fireEvent.keyDown(rows[1], { key: "ArrowUp" })
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: "ArrowUp" })
    expect(document.activeElement).toBe(rows[2])
  })
})
