import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

/**
 * The zero-products body of the list card. What is worth pinning is the one
 * wire that fails silently: the Import button is a callback into a dialog
 * mounted by `ProductsTable`, and a button that does nothing looks exactly
 * like a button that works. The rest is that Add product still goes through
 * the kind picker rather than a link, and that the tiles are decoration.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
}))

// Real messages: a key missing from `en.json` has to fail here rather than
// render its own name.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { ProductsEmpty } from "../list/products-empty"

describe("ProductsEmpty", () => {
  it("offers both ways in and wires Import to the caller", () => {
    const onImport = vi.fn()
    render(<ProductsEmpty onImportClick={onImport} />)

    expect(screen.getByText("Add your products")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(onImport).toHaveBeenCalledOnce()

    expect(screen.getByRole("button", { name: "Add product" })).toBeDefined()
    // The kind picker, never a link straight to the form.
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("keeps the illustration out of the accessibility tree", () => {
    render(<ProductsEmpty onImportClick={() => {}} />)
    // Not the first `aria-hidden` in the document: every lucide icon carries
    // one, and the Add product button's plus comes first.
    const tiles = document.querySelector('[data-slot="product-tiles"]')
    expect(tiles).not.toBeNull()
    expect(tiles!.getAttribute("aria-hidden")).toBe("true")
    expect(tiles!.querySelectorAll("svg").length).toBe(4)
  })

  it("is a different screen when a filter matched nothing", () => {
    render(<ProductsEmpty hasFilters />)
    expect(screen.getByText("No matching products")).toBeDefined()
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add product" })).toBeNull()
  })
})
