import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// One trigger for every "Add product" entry point. What matters is that it
// opens the kind picker rather than linking straight to `/products/new` —
// the dashboard home's card used to do exactly that and landed every new
// merchant on the bare simple-product form — and that the picker behind it
// still routes to the right `?kind=`.

const push = vi.fn()
const prefetch = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch }),
  useParams: () => ({ shopSlug: "acme" }),
}))

// Real messages rather than a key echo: the dialog behind the trigger is
// localized too, so a key echo would leave every row reading "SIMPLE.label".
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { AddProductButton } from "../list/add-product-button"

describe("AddProductButton", () => {
  beforeEach(() => {
    push.mockClear()
    prefetch.mockClear()
  })

  it("renders the localized label and opens the kind picker", () => {
    render(<AddProductButton />)
    fireEvent.click(screen.getByRole("button", { name: "Add product" }))
    expect(screen.getByText("What kind of product?")).toBeDefined()

    fireEvent.click(screen.getByText("Simple product"))
    expect(push).toHaveBeenCalledWith("/store/acme/products/new?kind=simple")
  })

  it("does not offer digital products (D12)", () => {
    render(<AddProductButton />)
    fireEvent.click(screen.getByRole("button", { name: "Add product" }))
    expect(screen.queryByText("Digital product")).toBeNull()
  })

  it("lets a caller's label win over the i18n key", () => {
    render(<AddProductButton label="Custom" />)
    expect(screen.getByRole("button", { name: "Custom" })).toBeDefined()
    expect(screen.queryByRole("button", { name: "Add product" })).toBeNull()
  })

  it("never links straight to the form", () => {
    render(<AddProductButton />)
    expect(screen.queryByRole("link")).toBeNull()
  })
})
