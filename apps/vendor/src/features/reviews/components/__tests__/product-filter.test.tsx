import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// The toolbar's product filter. What is worth pinning is its contract with
// the server and with the screen: nothing is fetched until the list opens,
// the typed text reaches `filters.search` only after the debounce, a click
// hands back the whole chip (id, label, thumbnail) rather than an id, and the
// clear button hands back null. Translations echo their key.

import { GET_PRODUCTS } from "@/features/products/api"
import type { Product, ProductsResponse } from "@/features/products/types"

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
  /** What every non-skipped `products` query resolves to. */
  result: { data: undefined as unknown, loading: false },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

// `next/image` wants a host allowlist and a loader; a bare tag proves the src.
vi.mock("@/shared/components/app-image", () => ({
  default: (props: { src: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- a test double, not a page image
    <img alt="" src={props.src} className={props.className} />
  ),
}))

const { ProductFilter } = await import("../product-filter")

beforeAll(() => {
  // Base UI positions the popup with floating-ui, which measures the anchor.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  // cmdk keeps the active row in view; jsdom has no layout to scroll.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const product = (over: Partial<Product>): Product =>
  ({ id: "p1", name: { en: "Dive Watch" }, slug: "dive-watch", ...over }) as Product

const PRODUCTS: ProductsResponse = {
  products: {
    success: true,
    data: [
      product({
        image: { thumbnail: "https://cdn.example/p1-thumb.jpg", original: "https://cdn.example/p1.jpg" },
      }),
      product({ id: "p2", name: { en: "Field Watch" }, slug: "field-watch" }),
      product({ id: "p3", name: null, slug: "unnamed-strap", image: null }),
    ],
  },
}

const NONE: ProductsResponse = {
  products: { success: true, data: [] },
}

beforeEach(() => {
  fixtures.result = { data: PRODUCTS, loading: false }
  fixtures.useQuery.mockReset()
  fixtures.useQuery.mockImplementation(
    (doc: unknown, options: { skip?: boolean } = {}) => {
      if (doc !== GET_PRODUCTS) throw new Error("unexpected query")
      if (options.skip) return { data: undefined, loading: false }
      return fixtures.result
    },
  )
})

/** The options of the latest `products` call. */
type Options = {
  skip?: boolean
  variables: { filters: { limit: number; sort_by: string; search?: string } }
}
const lastOptions = () =>
  fixtures.useQuery.mock.calls.at(-1)![1] as Options

const trigger = () => screen.getByRole("button", { name: "filters.product" })

const open = async () => {
  fireEvent.click(trigger())
  return waitFor(() => screen.getByPlaceholderText("filters.searchProducts"))
}

describe("ProductFilter", () => {
  it("reads 'all products' and fetches nothing while closed", () => {
    render(<ProductFilter value={null} onChange={vi.fn()} />)

    expect(trigger().textContent).toContain("filters.allProducts")
    // No clear button either — there is nothing to clear.
    expect(screen.queryByRole("button", { name: "filters.clearProduct" })).toBeNull()
    expect(lastOptions().skip).toBe(true)
  })

  it("lists the newest products on open, with no search sent", async () => {
    render(<ProductFilter value={null} onChange={vi.fn()} />)
    await open()

    expect(screen.getByText("Dive Watch")).toBeTruthy()
    expect(screen.getByText("Field Watch")).toBeTruthy()
    // An empty box sends no `search` key at all rather than `search: ""`.
    const { skip, variables } = lastOptions()
    expect(skip).toBe(false)
    expect(variables.filters).toEqual({ limit: 20, sort_by: "NEWEST" })
  })

  it("sends the trimmed text as the search after the debounce", async () => {
    render(<ProductFilter value={null} onChange={vi.fn()} />)
    const box = await open()

    fireEvent.change(box, { target: { value: "  watch " } })

    // The box shows the keystroke at once; the query follows 250 ms later.
    expect((box as HTMLInputElement).value).toBe("  watch ")
    await waitFor(() => expect(lastOptions().variables.filters.search).toBe("watch"))
  })

  it("hands back the whole chip when a row is picked", async () => {
    const onChange = vi.fn()
    render(<ProductFilter value={null} onChange={onChange} />)
    await open()

    fireEvent.click(screen.getByText("Dive Watch"))

    // Label and thumbnail travel with the id so the toolbar chip can render
    // without asking the server who "p1" is.
    expect(onChange).toHaveBeenCalledWith({
      id: "p1",
      label: "Dive Watch",
      image: "https://cdn.example/p1-thumb.jpg",
    })
  })

  it("labels a nameless product by its slug", async () => {
    render(<ProductFilter value={null} onChange={vi.fn()} />)
    await open()

    expect(screen.getByText("unnamed-strap")).toBeTruthy()
  })

  it("shows the selected product and clears it from the X", () => {
    const onChange = vi.fn()
    render(
      <ProductFilter
        value={{ id: "p1", label: "Dive Watch", image: "https://cdn.example/p1-thumb.jpg" }}
        onChange={onChange}
      />,
    )

    expect(trigger().textContent).toContain("Dive Watch")
    expect(trigger().querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example/p1-thumb.jpg",
    )

    fireEvent.click(screen.getByRole("button", { name: "filters.clearProduct" }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("says so when nothing matches", async () => {
    fixtures.result = { data: NONE, loading: false }
    render(<ProductFilter value={null} onChange={vi.fn()} />)
    await open()

    expect(screen.getByText("filters.noProducts")).toBeTruthy()
  })

  it("does not call an in-flight first page 'no products'", async () => {
    // cmdk's empty state keys on the row count, and the first page has none
    // until it lands — without the guard every open flashes "no products".
    fixtures.result = { data: undefined, loading: true }
    render(<ProductFilter value={null} onChange={vi.fn()} />)
    await open()

    expect(screen.queryByText("filters.noProducts")).toBeNull()
  })
})
