import { describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import {
  chunkIds,
  remindableCarts,
  selectAllBanner,
  selectedIdsOf,
  useCartSelection,
} from "../selection"
import { HIDE_BATCH_LIMIT, SELECT_ALL_LIMIT } from "../constants"
import type { AbandonedCart } from "../../types"

function cart(overrides: Partial<AbandonedCart>): AbandonedCart {
  return {
    id: "cart-1",
    status: "abandoned",
    reminder_status: "READY",
    hidden: false,
    items: [],
    item_count: 0,
    currency: "SAR",
    channels: { email: true, sms: false, whatsapp: false },
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("abandoned cart selection helpers", () => {
  it("lists the selected ids in the order they were selected", () => {
    expect(selectedIdsOf({ b: true, a: true, c: false })).toEqual(["b", "a"])
    expect(selectedIdsOf({})).toEqual([])
  })

  it("splits a long selection into full batches and drops nothing", () => {
    const ids = Array.from({ length: 250 }, (_, i) => `cart-${i}`)

    const batches = chunkIds(ids, HIDE_BATCH_LIMIT)

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 50])
    expect(batches.flat()).toEqual(ids)
    expect(chunkIds([], HIDE_BATCH_LIMIT)).toEqual([])
    expect(chunkIds(["only"], HIDE_BATCH_LIMIT)).toEqual([["only"]])
  })

  it("leaves hidden and completed carts out of a reminder run", () => {
    const rows = [
      cart({ id: "ready" }),
      cart({ id: "sent", reminder_status: "SENT" }),
      cart({ id: "failed", reminder_status: "FAILED" }),
      cart({ id: "returned", reminder_status: "RETURNED" }),
      cart({ id: "completed", reminder_status: "COMPLETED" }),
      cart({ id: "hidden", hidden: true }),
    ]

    // The same two cases the row's own Remind button is disabled for.
    expect(remindableCarts(rows).map((row) => row.id)).toEqual([
      "ready",
      "sent",
      "failed",
      "returned",
    ])
  })
})

describe("select-all banner", () => {
  const page = {
    allPageRowsSelected: true,
    pageRowCount: 15,
    selectedCount: 15,
    matching: null,
  }

  it("offers the whole list once the page is fully ticked", () => {
    expect(selectAllBanner({ ...page, total: 240 })).toEqual({
      kind: "offer",
      pageCount: 15,
      total: 240,
      limit: null,
    })
  })

  it("says before selecting that a longer list will be cut to its first rows", () => {
    expect(selectAllBanner({ ...page, total: 1240 })).toEqual({
      kind: "offer",
      pageCount: 15,
      total: 1240,
      limit: SELECT_ALL_LIMIT,
    })
    // Exactly the cap is a whole list, not a cut one.
    expect(selectAllBanner({ ...page, total: SELECT_ALL_LIMIT })).toMatchObject(
      { kind: "offer", limit: null },
    )
  })

  it("offers nothing when the page is the whole list, or is not fully ticked", () => {
    expect(selectAllBanner({ ...page, total: 15 })).toBeNull()
    expect(
      selectAllBanner({ ...page, total: 240, allPageRowsSelected: false }),
    ).toBeNull()
    expect(
      selectAllBanner({
        ...page,
        total: 0,
        pageRowCount: 0,
        selectedCount: 0,
      }),
    ).toBeNull()
  })

  it("offers nothing more once every reachable cart is already ticked", () => {
    // Ticked by hand across pages, with no id list asked for.
    expect(selectAllBanner({ ...page, total: 40, selectedCount: 40 })).toBeNull()
    expect(
      selectAllBanner({ ...page, total: 40, selectedCount: 39 }),
    ).toMatchObject({ kind: "offer", total: 40 })
  })

  it("states a whole-list selection, and a cut one as cut", () => {
    expect(
      selectAllBanner({
        ...page,
        total: 240,
        selectedCount: 240,
        matching: { total: 240, selected: 240 },
      }),
    ).toEqual({ kind: "all", selected: 240, total: 240, cut: false })

    expect(
      selectAllBanner({
        ...page,
        total: 1240,
        selectedCount: SELECT_ALL_LIMIT,
        matching: { total: 1240, selected: SELECT_ALL_LIMIT },
      }),
    ).toEqual({
      kind: "all",
      selected: SELECT_ALL_LIMIT,
      total: 1240,
      cut: true,
    })
  })

  it("stops calling a selection the whole list once it no longer is", () => {
    // 239 of 240: a row was unticked. Falls back to the page-level offer.
    expect(
      selectAllBanner({
        ...page,
        total: 240,
        selectedCount: 239,
        matching: { total: 240, selected: 240 },
      }),
    ).toMatchObject({ kind: "offer" })
  })
})

describe("useCartSelection", () => {
  it("keeps ticks from another page and counts them", () => {
    const { result } = renderHook(({ scope }) => useCartSelection(scope), {
      initialProps: { scope: "a" },
    })

    act(() => result.current.onRowSelectionChange({ "cart-1": true }))
    // TanStack hands an updater built from the selection it was given.
    act(() =>
      result.current.onRowSelectionChange((old) => ({ ...old, "cart-20": true })),
    )

    expect(selectedIdsOf(result.current.rowSelection)).toEqual([
      "cart-1",
      "cart-20",
    ])
  })

  it("drops the selection when the filter it was made under changes", () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useCartSelection(scope),
      { initialProps: { scope: "status:READY" } },
    )
    act(() => result.current.selectMatching("status:READY", ["a", "b"], 2))
    expect(selectedIdsOf(result.current.rowSelection)).toEqual(["a", "b"])
    expect(result.current.matching).toEqual({ total: 2, selected: 2 })

    rerender({ scope: "status:SENT" })

    expect(result.current.rowSelection).toEqual({})
    expect(result.current.matching).toBeNull()

    // A tick under the new filter starts from nothing, not from the old ids.
    act(() =>
      result.current.onRowSelectionChange((old) => ({ ...old, c: true })),
    )
    expect(selectedIdsOf(result.current.rowSelection)).toEqual(["c"])
  })

  it("ignores an id list that answers for a filter no longer on screen", () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useCartSelection(scope),
      { initialProps: { scope: "old" } },
    )
    rerender({ scope: "new" })

    // The request was made under "old" and lands after the chip changed.
    act(() => result.current.selectMatching("old", ["a", "b", "c"], 3))

    expect(result.current.rowSelection).toEqual({})
    expect(result.current.matching).toBeNull()
  })

  it("forgets that a selection was the whole list on the first manual change", () => {
    const { result } = renderHook(() => useCartSelection("scope"))
    act(() => result.current.selectMatching("scope", ["a", "b", "c"], 3))

    act(() =>
      result.current.onRowSelectionChange((old) => {
        const next = { ...old }
        delete next.b
        return next
      }),
    )

    expect(selectedIdsOf(result.current.rowSelection)).toEqual(["a", "c"])
    expect(result.current.matching).toBeNull()
  })

  it("clears on request", () => {
    const { result } = renderHook(() => useCartSelection("scope"))
    act(() => result.current.selectMatching("scope", ["a"], 1))

    act(() => result.current.clear())

    expect(result.current.rowSelection).toEqual({})
    expect(result.current.matching).toBeNull()
  })
})
