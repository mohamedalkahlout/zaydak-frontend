import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { useEffect, useState } from "react"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"

// The products list's search-and-filter field. What is worth pinning is the
// contract between its keyboard model and the URL: which keys it offers,
// what a chip writes, what Backspace and Escape take away, and that free
// text becomes a search only after the debounce — not the popover's looks.

import { GET_TAGS } from "@/features/tags/api"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import { GET_PRODUCT_CATEGORIES } from "@/features/products/api"
import type { ProductListQueryState } from "@/features/products/lib/list/query-state"

const fixtures = vi.hoisted(() => ({
  /** Flip to make the tags query report loading with no rows. */
  tagsLoading: false,
  /** Flip to make the shop own no tags at all. */
  tagsEmpty: false,
  /** Swap in a category list large enough to hit the row cap. */
  categories: null as unknown,
  useQuery: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
}))

// The real English catalogue: every name asserted below ("Tag", "Edit Tag
// filter", "No tags yet", "Type to narrow 10 more") is a message now.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { ProductsFilterBar } = await import(
  "../list/filter-bar/products-filter-bar"
)

const TAGS = {
  tags: {
    success: true,
    data: [
      { id: "t1", name: { en: "Unisex" }, slug: "unisex" },
      { id: "t2", name: { en: "Vintage" }, slug: "vintage" },
    ],
  },
}

const COLLECTIONS = {
  collections: {
    success: true,
    data: [
      { id: "col1", name: { en: "Summer" }, slug: "summer" },
      { id: "col2", name: { en: "Winter" }, slug: "winter" },
    ],
    meta: { total: 2, page: 1, total_pages: 1 },
  },
}

// Only the nodes the shop's own products sit on, most-used first — which is
// what `productCategories` returns and the order the rows keep.
const CATEGORIES = {
  productCategories: {
    success: true,
    data: [
      { id: "c1", slug: "apparel", path: "Apparel", parent_id: null, name: "Apparel", level: 0, product_count: 9 },
      { id: "c2", slug: "t-shirts", path: "Apparel > T-Shirts", parent_id: "c1", name: "T-Shirts", level: 1, product_count: 4 },
      { id: "c3", slug: "perfumes", path: "Perfumes & Colognes", parent_id: null, name: "Perfumes & Colognes", level: 0, product_count: 1 },
    ],
  },
}

beforeAll(() => {
  // Base UI positions the popup with floating-ui, which measures the anchor.
  // jsdom ships no ResizeObserver, and without one the popup never mounts.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const NO_TAGS = { tags: { success: true, data: [] } }

/** Seventy categories: ten past the cap the value list draws. */
const MANY_CATEGORIES = {
  productCategories: {
    success: true,
    data: Array.from({ length: 70 }, (_, i) => ({
      id: `n${i}`,
      name: `Node ${i}`,
      path: `Node ${i}`,
      slug: `n${i}`,
      parent_id: null,
      level: 0,
      product_count: 1,
    })),
  },
}

beforeEach(() => {
  fixtures.tagsLoading = false
  fixtures.tagsEmpty = false
  fixtures.categories = CATEGORIES
  fixtures.useQuery.mockClear()
  fixtures.useQuery.mockImplementation(
    (doc: unknown, options: { skip?: boolean } = {}) => {
      if (options.skip) return { data: undefined, loading: false }
      if (doc === GET_TAGS) {
        if (fixtures.tagsLoading) return { data: undefined, loading: true }
        return { data: fixtures.tagsEmpty ? NO_TAGS : TAGS, loading: false }
      }
      if (doc === GET_SHOP_COLLECTIONS) return { data: COLLECTIONS, loading: false }
      if (doc === GET_PRODUCT_CATEGORIES) {
        return { data: fixtures.categories, loading: false }
      }
      return { data: undefined, loading: false }
    },
  )
})

/** The `skip` each `useQuery` call for `doc` was given, in call order. */
const skipsOf = (doc: unknown) =>
  fixtures.useQuery.mock.calls
    .filter(([d]) => d === doc)
    .map(([, o]) => (o as { skip?: boolean }).skip)

afterEach(() => {
  vi.useRealTimers()
})

type Patch = Partial<ProductListQueryState>
type Opts = { resetPage?: boolean } | undefined

/**
 * Holds the query state the way the table does, so a written patch comes
 * straight back as props and a chip appears for it.
 */
function Harness({
  initial = {},
  onQueryChange,
  onReset,
}: {
  initial?: Patch
  onQueryChange?: (patch: Patch, opts: Opts) => void
  onReset?: () => void
}) {
  const [state, setState] = useState<ProductListQueryState>({
    page: 1,
    limit: 6,
    ...initial,
  })
  return (
    <ProductsFilterBar
      state={state}
      onQueryChange={(patch, opts) => {
        onQueryChange?.(patch, opts)
        setState((prev) => ({
          ...prev,
          ...patch,
          page: opts?.resetPage ? 1 : prev.page,
        }))
      }}
      onReset={() => {
        onReset?.()
        setState({ page: 1, limit: 6 })
      }}
      leading={<button type="button">All</button>}
    />
  )
}

/** Lands the oldest written patch of the mounted `DeferredHarness`. */
let flushOne: () => void = () => {}

/**
 * The same, except a written patch does not come back until `commit()` is
 * called — which is what the table really does: the URL write is a
 * transition, and the bar keeps seeing the old state until the refetch lands.
 * Each call commits one patch, in the order they were written. It is a
 * function rather than a button because clicking anything outside the bar
 * would close the dropdown, which is not what a landing URL does.
 */
function DeferredHarness({
  onQueryChange,
}: {
  onQueryChange?: (patch: Patch, opts: Opts) => void
}) {
  const [state, setState] = useState<ProductListQueryState>({
    page: 1,
    limit: 6,
  })
  const [queue, setQueue] = useState<Patch[]>([])
  // Published from an effect: writing a module variable during render is a
  // side effect the compiler rules refuse, and after commit is soon enough.
  useEffect(() => {
    flushOne = () => {
      const [next, ...rest] = queue
      if (!next) return
      setQueue(rest)
      setState((prev) => ({ ...prev, ...next }))
    }
  })
  return (
    <ProductsFilterBar
      state={state}
      onQueryChange={(patch, opts) => {
        onQueryChange?.(patch, opts)
        setQueue((q) => [...q, patch])
      }}
      onReset={() => setState({ page: 1, limit: 6 })}
    />
  )
}

const input = () =>
  screen.getByRole("combobox", { name: "Search and filter products" })

const commit = () => {
  act(() => flushOne())
}

const type = (value: string) =>
  fireEvent.change(input(), { target: { value } })

const key = (k: string) => fireEvent.keyDown(input(), { key: k })

/**
 * A chip's whole sentence. "Tag is" lives in the edit button and the values
 * in the pill beside it, so reading the button alone would only ever see the
 * key half.
 */
const chipText = (label: string) =>
  screen
    .getByRole("button", { name: `Edit ${label} filter` })
    .parentElement!.textContent!.replace(/\s+/g, " ")
    .trim()

describe("ProductsFilterBar", () => {
  it("lists the filter keys on focus, and Status is not one of them", async () => {
    render(<Harness />)
    fireEvent.focus(input())

    await screen.findByRole("listbox")
    for (const label of [
      "Tag",
      "Category",
      "Collection",
      "Type",
      "Selling method",
      "Stock",
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeTruthy()
    }
    expect(screen.queryByRole("option", { name: "Status" })).toBeNull()
    expect(input().getAttribute("aria-expanded")).toBe("true")
  })

  it("narrows the keys as you type, and Enter picks the match as a pending chip", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")

    type("ta")
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(screen.getByRole("option", { name: "Tag" })).toBeTruthy()

    key("Enter")

    // The chip reads "Tag is" with nothing after it, the text is cleared, and
    // the list has switched to the key's values.
    expect(chipText("Tag")).toBe("Tag is")
    expect((input() as HTMLInputElement).value).toBe("")
    expect(await screen.findByRole("option", { name: "Unisex" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "Vintage" })).toBeTruthy()
    expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBe(
      "true",
    )
  })

  it("applies a toggled value at once and keeps the list open", async () => {
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    type("ta")
    key("Enter")

    fireEvent.click(await screen.findByRole("option", { name: "Unisex" }))

    expect(onQueryChange).toHaveBeenCalledWith(
      { tag_ids: ["t1"] },
      { resetPage: true },
    )
    expect(screen.getByRole("listbox")).toBeTruthy()
    expect(
      screen.getByRole("option", { name: "Unisex" }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(chipText("Tag")).toContain("Unisex")

    // A second value joins the first rather than replacing it.
    fireEvent.click(screen.getByRole("option", { name: "Vintage" }))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { tag_ids: ["t1", "t2"] },
      { resetPage: true },
    )
  })

  it("makes Category single-select and writes system_category_id", async () => {
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")

    fireEvent.click(screen.getByRole("option", { name: "Category" }))
    expect(
      screen.getByRole("listbox").getAttribute("aria-multiselectable"),
    ).toBeNull()

    fireEvent.click(await screen.findByRole("option", { name: "T-Shirts" }))
    expect(onQueryChange).toHaveBeenCalledWith(
      { system_category_id: "c2" },
      { resetPage: true },
    )

    // Picking another replaces rather than accumulates.
    fireEvent.click(screen.getByRole("option", { name: "Apparel" }))
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { system_category_id: "c1" },
      { resetPage: true },
    )

    // Clicking the chosen one again deselects it: the field is written as
    // undefined and the chip is back to pending, with nothing after "is".
    fireEvent.click(screen.getByRole("option", { name: "Apparel" }))
    const [patch, opts] = onQueryChange.mock.lastCall!
    expect(Object.keys(patch)).toEqual(["system_category_id"])
    expect(patch.system_category_id).toBeUndefined()
    expect(opts).toEqual({ resetPage: true })
    expect(chipText("Category")).toBe("Category is")
  })

  it("lists the shop's own categories, in the order the server ranks them", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    type("categ")
    key("Enter")

    // `productCategories` returns the nodes the shop's products sit on,
    // most-used first. The rows keep that order rather than re-sorting by
    // name, so the category most of the catalogue is filed under is on top.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("Apparel"),
      expect.stringContaining("T-Shirts"),
      expect.stringContaining("Perfumes & Colognes"),
    ])
  })

  it("narrows category rows by their path as well as their name", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    fireEvent.click(screen.getByRole("option", { name: "Category" }))
    await screen.findByRole("option", { name: "T-Shirts" })

    type("apparel")
    const names = screen.getAllByRole("option").map((o) => o.textContent)
    expect(names.some((n) => n?.includes("Apparel"))).toBe(true)
    expect(names.some((n) => n?.includes("T-Shirts"))).toBe(true)
    expect(names.some((n) => n?.includes("Perfumes"))).toBe(false)
  })

  it("removes the last chip on Backspace in an empty input", async () => {
    const onQueryChange = vi.fn()
    render(
      <Harness
        initial={{ tag_ids: ["t1"], product_types: ["SIMPLE"] }}
        onQueryChange={onQueryChange}
      />,
    )
    expect(screen.getByRole("button", { name: "Edit Tag filter" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Edit Type filter" })).toBeTruthy()

    key("Backspace")

    // Type is last in key order, so it goes first; Tag stays.
    expect(onQueryChange).toHaveBeenCalledWith(
      { product_types: undefined },
      { resetPage: true },
    )
    expect(screen.queryByRole("button", { name: "Edit Type filter" })).toBeNull()
    expect(screen.getByRole("button", { name: "Edit Tag filter" })).toBeTruthy()

    key("Backspace")
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { tag_ids: undefined },
      { resetPage: true },
    )
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Edit Tag filter" })).toBeNull(),
    )
  })

  it("removes a chip from its own X, which a pending chip has none of", async () => {
    const onQueryChange = vi.fn()
    render(
      <Harness
        initial={{ tag_ids: ["t1"], product_types: ["SIMPLE"] }}
        onQueryChange={onQueryChange}
      />,
    )

    // The X removes its own chip, not the last one — Tag is first in key
    // order and Type stays.
    fireEvent.click(screen.getByRole("button", { name: "Remove Tag filter" }))
    expect(onQueryChange).toHaveBeenCalledWith(
      { tag_ids: undefined },
      { resetPage: true },
    )
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Edit Tag filter" })).toBeNull(),
    )
    expect(screen.getByRole("button", { name: "Edit Type filter" })).toBeTruthy()

    // The X lives in the value pill, so a pending chip — which has no values
    // and therefore no pill — carries none. Escape and Backspace are what
    // take that one back, and both are pinned below.
    fireEvent.focus(input())
    type("coll")
    key("Enter")
    expect(screen.getByRole("button", { name: "Edit Collection filter" })).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Remove Collection filter" }),
    ).toBeNull()
  })

  it("reopens a chip's values when the chip is clicked", async () => {
    render(<Harness initial={{ tag_ids: ["t2"] }} />)

    expect(chipText("Tag")).toContain("Vintage")
    fireEvent.click(screen.getByRole("button", { name: "Edit Tag filter" }))

    const vintage = await screen.findByRole("option", { name: "Vintage" })
    expect(vintage.getAttribute("aria-selected")).toBe("true")
    expect(
      screen.getByRole("option", { name: "Unisex" }).getAttribute("aria-selected"),
    ).toBe("false")
  })

  it("applies free text as the search after the debounce", () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)

    type("mug")
    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onQueryChange).toHaveBeenCalledWith(
      { search: "mug" },
      { resetPage: true },
    )
    expect(onQueryChange).toHaveBeenCalledTimes(1)
  })

  it("restarts the debounce on every keystroke", () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)

    type("m")
    act(() => {
      vi.advanceTimersByTime(200)
    })
    type("mu")
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange).toHaveBeenCalledWith(
      { search: "mu" },
      { resetPage: true },
    )
  })

  it("takes back a search that was only ever a key's name", () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)

    type("ta")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { search: "ta" },
      { resetPage: true },
    )

    // Enter picks Tag: the "ta" that already went out as the search is cleared.
    // `toHaveBeenLastCalledWith({ search: undefined })` would also accept an
    // empty patch, so the key is checked by name.
    key("Enter")
    const [patch, opts] = onQueryChange.mock.lastCall!
    expect(Object.keys(patch)).toEqual(["search"])
    expect(patch.search).toBeUndefined()
    expect(opts).toEqual({ resetPage: true })
    expect(screen.getByRole("button", { name: "Edit Tag filter" })).toBeTruthy()
  })

  it("does not search while a key's values are being narrowed", async () => {
    const onQueryChange = vi.fn()
    render(<Harness initial={{ tag_ids: ["t1"] }} onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit Tag filter" }))
    await screen.findByRole("option", { name: "Vintage" })

    vi.useFakeTimers()
    type("vin")
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(onQueryChange).not.toHaveBeenCalled()
    expect(screen.queryByRole("option", { name: "Unisex" })).toBeNull()
    expect(screen.getByRole("option", { name: "Vintage" })).toBeTruthy()
  })

  it("clears everything through the clear button", async () => {
    const onReset = vi.fn()
    render(<Harness initial={{ tag_ids: ["t1"], search: "mug" }} onReset={onReset} />)
    expect((input() as HTMLInputElement).value).toBe("mug")

    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect((input() as HTMLInputElement).value).toBe("")
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Edit Tag filter" })).toBeNull(),
    )
    // Nothing left to clear, so the button goes with it.
    expect(
      screen.queryByRole("button", { name: "Clear search and filters" }),
    ).toBeNull()
  })

  it("drops a pending chip on Escape when it has no values", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    type("ta")
    key("Enter")
    expect(screen.getByRole("button", { name: "Edit Tag filter" })).toBeTruthy()

    key("Escape")

    expect(screen.queryByRole("button", { name: "Edit Tag filter" })).toBeNull()
    expect(input().getAttribute("aria-expanded")).toBe("false")
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
  })

  it("keeps a chip that has values when Escape closes its list, and drops the narrowing text", async () => {
    render(<Harness initial={{ tag_ids: ["t1"] }} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit Tag filter" }))
    await screen.findByRole("option", { name: "Unisex" })
    type("uni")

    key("Escape")

    expect(input().getAttribute("aria-expanded")).toBe("false")
    expect((input() as HTMLInputElement).value).toBe("")
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
    expect(chipText("Tag")).toContain("Unisex")
  })

  it("restores an applied search to the field after a chip was edited", async () => {
    const onQueryChange = vi.fn()
    render(
      <Harness
        initial={{ tag_ids: ["t1"], search: "mug" }}
        onQueryChange={onQueryChange}
      />,
    )
    expect((input() as HTMLInputElement).value).toBe("mug")

    // Editing the chip turns the field into the value narrower...
    fireEvent.click(screen.getByRole("button", { name: "Edit Tag filter" }))
    await screen.findByRole("option", { name: "Vintage" })
    expect((input() as HTMLInputElement).value).toBe("")
    fireEvent.click(screen.getByRole("option", { name: "Vintage" }))

    // ...and leaving brings the search the list is still applying back.
    key("Escape")
    expect((input() as HTMLInputElement).value).toBe("mug")
    expect(
      onQueryChange.mock.calls.some(([patch]) => "search" in patch),
    ).toBe(false)
  })

  it("restores the search when Backspace drops a pending chip", async () => {
    render(<Harness initial={{ search: "mug" }} />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    // Select-all and type over the search: "ta" names Tag.
    type("ta")
    key("Enter")
    expect((input() as HTMLInputElement).value).toBe("")

    key("Backspace")
    expect(screen.queryByRole("button", { name: "Edit Tag filter" })).toBeNull()
    expect((input() as HTMLInputElement).value).toBe("mug")
  })

  it("moves aria-activedescendant with the arrow keys and wraps", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")

    const options = screen.getAllByRole("option")
    expect(input().getAttribute("aria-activedescendant")).toBe(options[0]!.id)

    key("ArrowDown")
    expect(input().getAttribute("aria-activedescendant")).toBe(options[1]!.id)
    expect(options[1]!.hasAttribute("data-active")).toBe(true)

    key("ArrowUp")
    expect(input().getAttribute("aria-activedescendant")).toBe(options[0]!.id)

    // Up from the top wraps to the bottom.
    key("ArrowUp")
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options[options.length - 1]!.id,
    )
  })

  it("offers to search for text that names no key, and Enter applies it at once", async () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)
    fireEvent.focus(input())
    type("mug")

    expect(screen.getByRole("option", { name: "Search for “mug”" })).toBeTruthy()
    key("Enter")

    expect(onQueryChange).toHaveBeenCalledWith(
      { search: "mug" },
      { resetPage: true },
    )
    // The debounce was cancelled — nothing fires a second time.
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
  })

  it("reads a chip as a count while its names are still loading", () => {
    fixtures.tagsLoading = true
    render(<Harness initial={{ tag_ids: ["t1", "t2"] }} />)
    expect(chipText("Tag")).toContain("2 selected")
  })

  it("renders an id it cannot name rather than dropping the chip", () => {
    render(<Harness initial={{ tag_ids: ["gone"] }} />)
    expect(chipText("Tag")).toContain("gone")
  })

  it("re-seeds the text when the search changes from outside", () => {
    function Outside() {
      const [state, setState] = useState<ProductListQueryState>({
        page: 1,
        limit: 6,
        search: "mug",
      })
      return (
        <>
          <button type="button" onClick={() => setState({ page: 1, limit: 6 })}>
            back
          </button>
          <ProductsFilterBar
            state={state}
            onQueryChange={(patch) => setState((p) => ({ ...p, ...patch }))}
            onReset={() => setState({ page: 1, limit: 6 })}
          />
        </>
      )
    }
    render(<Outside />)
    expect((input() as HTMLInputElement).value).toBe("mug")
    fireEvent.click(screen.getByRole("button", { name: "back" }))
    expect((input() as HTMLInputElement).value).toBe("")
  })

  it("leaves what was typed since alone when its own search lands late", () => {
    vi.useFakeTimers()
    render(<DeferredHarness />)

    // "m" goes out after the debounce, but the URL has not caught up when
    // the vendor types the next letter.
    type("m")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    type("mu")
    commit()
    expect((input() as HTMLInputElement).value).toBe("mu")

    // The fuller search still goes out on its own debounce.
    act(() => {
      vi.advanceTimersByTime(300)
    })
    commit()
    expect((input() as HTMLInputElement).value).toBe("mu")
  })

  it("takes back a key-name search that has not landed yet", async () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(<DeferredHarness onQueryChange={onQueryChange} />)

    type("ta")
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onQueryChange).toHaveBeenLastCalledWith(
      { search: "ta" },
      { resetPage: true },
    )

    // Enter picks Tag before the "ta" URL commits: the search is still
    // withdrawn, because the bar remembers what it sent.
    key("Enter")
    const [patch] = onQueryChange.mock.lastCall!
    expect(Object.keys(patch)).toEqual(["search"])
    expect(patch.search).toBeUndefined()

    // The stale "ta" landing must not pour into the value narrower.
    commit()
    expect((input() as HTMLInputElement).value).toBe("")
    commit()
    expect((input() as HTMLInputElement).value).toBe("")
    vi.useRealTimers()
    expect(await screen.findByRole("option", { name: "Unisex" })).toBeTruthy()
  })

  it("fetches tags, collections and the shop's categories only when a key needs them", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")

    for (const doc of [GET_TAGS, GET_SHOP_COLLECTIONS, GET_PRODUCT_CATEGORIES]) {
      expect(skipsOf(doc).length).toBeGreaterThan(0)
      expect(skipsOf(doc).every((skip) => skip === true)).toBe(true)
    }

    fireEvent.click(screen.getByRole("option", { name: "Category" }))
    await screen.findByRole("option", { name: "T-Shirts" })
    expect(skipsOf(GET_PRODUCT_CATEGORIES).at(-1)).toBe(false)
    expect(skipsOf(GET_TAGS).at(-1)).toBe(true)
    expect(skipsOf(GET_SHOP_COLLECTIONS).at(-1)).toBe(true)
  })

  it("fetches a source the URL already names, so its chip can be read", () => {
    render(<Harness initial={{ system_category_id: "c2" }} />)
    expect(chipText("Category")).toContain("T-Shirts")
    expect(skipsOf(GET_PRODUCT_CATEGORIES).at(-1)).toBe(false)
    expect(skipsOf(GET_TAGS).at(-1)).toBe(true)
  })

  it("caps the value rows at sixty and asks for typing to reach the rest", async () => {
    fixtures.categories = MANY_CATEGORIES
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    fireEvent.click(screen.getByRole("option", { name: "Category" }))

    await screen.findByRole("option", { name: "Node 0" })
    expect(screen.getAllByRole("option")).toHaveLength(60)
    expect(screen.getByText("Type to narrow 10 more")).toBeTruthy()

    // Node 6 and Node 60 to 69.
    type("Node 6")
    expect(screen.getAllByRole("option")).toHaveLength(11)
    expect(screen.queryByText(/Type to narrow/)).toBeNull()
  })

  it("shows skeleton rows, and no active descendant, while a key's values load", async () => {
    fixtures.tagsLoading = true
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    fireEvent.click(screen.getByRole("option", { name: "Tag" }))

    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).toBeTruthy(),
    )
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(input().getAttribute("aria-activedescendant")).toBeNull()
  })

  it("says so when a key has no values yet, and when nothing matches", async () => {
    fixtures.tagsEmpty = true
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    fireEvent.click(screen.getByRole("option", { name: "Tag" }))

    expect(await screen.findByText("No tags yet")).toBeTruthy()
    expect(screen.getByText("No tags yet").getAttribute("role")).toBe("status")
    type("x")
    expect(screen.getByText("No tags match \u201cx\u201d")).toBeTruthy()
    // The listbox stays mounted, empty, so aria-controls still points somewhere.
    expect(screen.getByRole("listbox")).toBeTruthy()
  })

  it("names the listbox after the active key and describes the input with its chip", async () => {
    render(<Harness initial={{ tag_ids: ["t1"] }} />)
    expect(input().getAttribute("aria-describedby")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Edit Tag filter" }))
    await screen.findByRole("listbox", { name: "Tag values" })

    const describedBy = input().getAttribute("aria-describedby")!
    expect(document.getElementById(describedBy)?.textContent).toBe("Tag is Unisex")
  })

  it("never takes focus off the input on a press anywhere in the dropdown", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    const listbox = await screen.findByRole("listbox")

    // A prevented mousedown is what stops the browser moving focus; jsdom
    // does not move it itself, so the prevention is what is checked.
    expect(fireEvent.mouseDown(listbox)).toBe(false)
    expect(fireEvent.mouseDown(screen.getByRole("option", { name: "Tag" }))).toBe(false)
  })

  it("closes on Tab", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")

    key("Tab")
    expect(input().getAttribute("aria-expanded")).toBe("false")
  })

  it("applies the search at once on Enter with the dropdown closed", () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)

    type("mug")
    // Escape closes the list but keeps the text: no key was active.
    key("Escape")
    expect((input() as HTMLInputElement).value).toBe("mug")
    key("Enter")
    expect(onQueryChange).toHaveBeenCalledWith({ search: "mug" }, { resetPage: true })
    expect(onQueryChange).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
  })

  it("keeps Home and End as caret keys while there is text to move through", async () => {
    render(<Harness />)
    fireEvent.focus(input())
    await screen.findByRole("listbox")
    const options = screen.getAllByRole("option")

    // Empty field: End jumps the highlight.
    key("End")
    expect(input().getAttribute("aria-activedescendant")).toBe(
      options[options.length - 1]!.id,
    )
    key("Home")
    expect(input().getAttribute("aria-activedescendant")).toBe(options[0]!.id)

    // With text, the keys are left to the browser.
    type("t")
    expect(fireEvent.keyDown(input(), { key: "End" })).toBe(true)
  })
})
