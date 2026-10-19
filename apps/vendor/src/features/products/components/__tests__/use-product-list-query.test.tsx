import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"

/**
 * What the hook promises the toolbar: a write is visible the moment it is
 * made, not when the router catches up. The list reads its data with a
 * suspense query inside a transition, so the committed URL lags every write
 * by a round-trip; anything computed from it in that window is computed
 * from the state before the last write. The cases here are the ones that
 * went wrong because of it — two toggles in one round-trip, a view change
 * followed by a toggle — plus the two ways the optimistic state must let go:
 * the write landing, and the vendor going somewhere else instead.
 */

let searchParams = new URLSearchParams()
const replace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/acme/products",
  useSearchParams: () => searchParams,
}))

import { useProductListQuery } from "../list/use-product-list-query"

/** The query string of the last URL written. */
const lastWritten = () => {
  const url = replace.mock.lastCall![0] as string
  return url.split("?")[1] ?? ""
}

/** Simulates the router catching up to a URL. */
function land(rerender: () => void, query: string) {
  searchParams = new URLSearchParams(query)
  act(() => rerender())
}

beforeEach(() => {
  searchParams = new URLSearchParams()
  replace.mockClear()
})

describe("useProductListQuery", () => {
  it("shows a write before it lands, and builds the next write on it", () => {
    const { result, rerender } = renderHook(() => useProductListQuery())

    act(() => {
      result.current.updateQuery({ tag_ids: ["t1"] }, { resetPage: true })
    })
    expect(lastWritten()).toBe("page=1&tag_ids=t1")
    // The URL has not moved, so the committed state has not either...
    expect(result.current.queryState.tag_ids).toBeUndefined()
    // ...but the toolbar already sees the tag, and a second toggle inside
    // the same round-trip keeps the first.
    expect(result.current.shownState.tag_ids).toEqual(["t1"])

    act(() => {
      result.current.updateQuery(
        { tag_ids: [...(result.current.shownState.tag_ids ?? []), "t2"] },
        { resetPage: true },
      )
    })
    expect(lastWritten()).toBe("page=1&tag_ids=t1&tag_ids=t2")
    expect(result.current.shownState.tag_ids).toEqual(["t1", "t2"])

    // The first write landing does not throw the second away.
    land(rerender, "page=1&tag_ids=t1")
    expect(result.current.shownState.tag_ids).toEqual(["t1", "t2"])
    expect(result.current.queryState.tag_ids).toEqual(["t1"])

    // The second landing reconciles: shown and committed agree again.
    land(rerender, "page=1&tag_ids=t1&tag_ids=t2")
    expect(result.current.shownState).toEqual(result.current.queryState)
    expect(result.current.queryState.tag_ids).toEqual(["t1", "t2"])
  })

  it("keeps a view change when a filter toggle follows it in the same round-trip", () => {
    const { result } = renderHook(() => useProductListQuery())

    act(() => {
      result.current.updateQuery({ statuses: ["DRAFT"] }, { resetPage: true })
    })
    act(() => {
      result.current.updateQuery({ tag_ids: ["t1"] }, { resetPage: true })
    })

    expect(lastWritten()).toBe("page=1&statuses=DRAFT&tag_ids=t1")
    expect(result.current.shownState.statuses).toEqual(["DRAFT"])
    expect(result.current.shownState.tag_ids).toEqual(["t1"])
  })

  it("drops the optimistic state when the URL goes somewhere else instead", () => {
    const { result, rerender } = renderHook(() => useProductListQuery())

    act(() => {
      result.current.updateQuery({ tag_ids: ["t1"] }, { resetPage: true })
    })
    expect(result.current.shownState.tag_ids).toEqual(["t1"])

    // Back button: the write never landed and the shown state is a lie.
    land(rerender, "page=2&search=mug")
    expect(result.current.shownState).toEqual(result.current.queryState)
    expect(result.current.shownState.tag_ids).toBeUndefined()
    expect(result.current.shownState.search).toBe("mug")
  })

  it("does not write a URL that is already the one it would build from", () => {
    searchParams = new URLSearchParams("page=1&tag_ids=t1")
    const { result } = renderHook(() => useProductListQuery())

    act(() => {
      result.current.updateQuery({ tag_ids: ["t1"] })
    })
    expect(replace).not.toHaveBeenCalled()
  })

  it("normalizes the deprecated singular keys away on any write", () => {
    searchParams = new URLSearchParams("status=DRAFT&product_type=SIMPLE")
    const { result } = renderHook(() => useProductListQuery())

    act(() => {
      result.current.updateQuery({ search: "mug" }, { resetPage: true })
    })
    const written = new URLSearchParams(lastWritten())
    expect(written.get("status")).toBeNull()
    expect(written.get("product_type")).toBeNull()
    // The singular values themselves survive as their plural keys.
    expect(written.getAll("statuses")).toEqual(["DRAFT"])
    expect(written.getAll("product_types")).toEqual(["SIMPLE"])
    expect(written.get("search")).toBe("mug")
  })
})
