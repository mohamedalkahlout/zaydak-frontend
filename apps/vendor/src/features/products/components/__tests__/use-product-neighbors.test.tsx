import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

/**
 * What the arrows promise: they step through *the list the vendor arrived
 * from*, so the three cases worth pinning are the middle of a page, the two
 * page edges, and no list at all.
 *
 * The edge case is the one that breaks quietly. The row above the first on
 * page 3 is the last row of page 2, and getting it wrong does not throw — the
 * arrow just goes dark at every page boundary, which reads as "you are at the
 * end of the list" six rows into a hundred.
 *
 * The last case is the reason the hook parses the URL at all: opening
 * `/products/mug/edit` with no query string leaves it looking at page 1, where
 * the product usually is not, and both arrows must be disabled rather than
 * pointing at whatever happens to sit in page 1.
 */

let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}))

/** One shop, twelve products, six to a page — the list's own PAGE_SIZE. */
const ALL = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i + 1}`,
  slug: `product-${i + 1}`,
  name: { en: `Product ${i + 1}`, ar: "" },
}))

function pageOf(page: number) {
  return {
    products: {
      success: true,
      data: ALL.slice((page - 1) * 6, page * 6),
      meta: { total: ALL.length, page, limit: 6, total_pages: 2 },
    },
  }
}

const useQuery = vi.fn()
vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}))

import { useProductNeighbors } from "../form/use-product-neighbors"

/** Answer each `useQuery` from `pageOf`, honouring `skip`. */
function serveList() {
  useQuery.mockImplementation(
    (_doc: unknown, options: { variables: { filters: { page: number } }; skip?: boolean }) => {
      if (options.skip) return { data: undefined, loading: false }
      return { data: pageOf(options.variables.filters.page), loading: false }
    },
  )
}

beforeEach(() => {
  useQuery.mockReset()
  searchParams = new URLSearchParams()
})

describe("useProductNeighbors", () => {
  it("steps within a page", () => {
    searchParams = new URLSearchParams({ page: "1" })
    serveList()

    const { result } = renderHook(() => useProductNeighbors("product-3"))

    expect(result.current.previous).toMatchObject({ slug: "product-2", page: 1 })
    expect(result.current.next).toMatchObject({ slug: "product-4", page: 1 })
  })

  it("crosses a page boundary and carries the new page number", () => {
    searchParams = new URLSearchParams({ page: "2" })
    serveList()

    // First row of page 2: the row above it is the last row of page 1.
    const { result } = renderHook(() => useProductNeighbors("product-7"))

    expect(result.current.previous).toMatchObject({ slug: "product-6", page: 1 })
    expect(result.current.next).toMatchObject({ slug: "product-8", page: 2 })
  })

  it("has no previous at the top and no next at the bottom", () => {
    searchParams = new URLSearchParams({ page: "1" })
    serveList()
    const first = renderHook(() => useProductNeighbors("product-1"))
    expect(first.result.current.previous).toBeUndefined()

    searchParams = new URLSearchParams({ page: "2" })
    serveList()
    const last = renderHook(() => useProductNeighbors("product-12"))
    expect(last.result.current.next).toBeUndefined()
  })

  it("keeps the list's filters, so the arrows walk the filtered list", () => {
    searchParams = new URLSearchParams({ page: "1", statuses: "DRAFT", search: "mug" })
    serveList()

    renderHook(() => useProductNeighbors("product-2"))

    const [, options] = useQuery.mock.calls[0] as [
      unknown,
      { variables: { filters: Record<string, unknown> } },
    ]
    expect(options.variables.filters).toMatchObject({
      page: 1,
      search: "mug",
      statuses: ["DRAFT"],
    })
  })

  it("disables both arrows when the product is not in the list it looked at", () => {
    serveList()

    const { result } = renderHook(() => useProductNeighbors("some-other-product"))

    expect(result.current.previous).toBeUndefined()
    expect(result.current.next).toBeUndefined()
  })
})
