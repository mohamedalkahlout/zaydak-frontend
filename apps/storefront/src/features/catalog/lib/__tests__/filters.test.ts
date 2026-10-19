import { describe, expect, it } from "vitest"

import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  PAGE_SIZE,
  activeFilterCount,
  catalogHasMore,
  readFilters,
  toProductFilterInput,
  writeFilters,
} from "../filters"

const read = (query: string) => readFilters(new URLSearchParams(query))

describe("readFilters", () => {
  it("defaults an empty query", () => {
    expect(read("")).toEqual(EMPTY_FILTERS)
  })

  it("reads every supported parameter", () => {
    expect(
      read(
        "search=mug&sort=PRICE_LOW&min=10&max=99&stock=in&tags=a,b&category=cat-1",
      ),
    ).toEqual({
      search: "mug",
      sort: "PRICE_LOW",
      minPrice: 10,
      maxPrice: 99,
      inStockOnly: true,
      tagIds: ["a", "b"],
      collectionIds: [],
      categoryId: "cat-1",
    })
  })

  it("ignores a leftover page query param", () => {
    // Old numbered-pagination links still arrive with `?page=`; the catalogue
    // always starts at the top of the list and scrolls for more.
    expect(read("page=3")).toEqual(EMPTY_FILTERS)
    expect(toProductFilterInput(read("page=3")).page).toBe(1)
  })

  it("falls back on an unknown sort rather than passing it to the API", () => {
    expect(read("sort=CHEAPEST").sort).toBe(DEFAULT_SORT)
  })

  it("rejects a non-numeric or negative price bound", () => {
    // `Number("abc")` is NaN and `Number("")` is 0 — both would go out as a
    // real bound if the guard only checked for null.
    expect(read("min=abc").minPrice).toBeNull()
    expect(read("min=-5").minPrice).toBeNull()
    expect(read("min=").minPrice).toBeNull()
  })

  it("drops empty entries from a list", () => {
    expect(read("tags=a,,b,").tagIds).toEqual(["a", "b"])
  })

  it("treats any stock value other than `in` as off", () => {
    expect(read("stock=out").inStockOnly).toBe(false)
  })
})

describe("writeFilters", () => {
  it("writes nothing for the default state", () => {
    // A URL of `?sort=NEWEST` makes an unfiltered catalogue look filtered, and
    // gives two URLs for one view that Apollo would cache twice.
    expect(writeFilters(EMPTY_FILTERS)).toBe("")
  })

  it("omits the default sort and never writes page", () => {
    expect(writeFilters({ ...EMPTY_FILTERS, sort: DEFAULT_SORT })).toBe("")
    expect(writeFilters({ ...EMPTY_FILTERS, search: "mug" })).toBe(
      "?search=mug",
    )
    expect(writeFilters({ ...EMPTY_FILTERS, search: "mug" })).not.toMatch(
      /page=/,
    )
  })

  it("round-trips a fully populated state", () => {
    const filters = {
      search: "blue mug",
      sort: "PRICE_HIGH" as const,
      minPrice: 5,
      maxPrice: 50,
      inStockOnly: true,
      tagIds: ["t1", "t2"],
      collectionIds: ["c1"],
      categoryId: "cat-1",
    }
    expect(read(writeFilters(filters).slice(1))).toEqual(filters)
  })

  it("keeps a zero price bound, which is a real filter", () => {
    expect(writeFilters({ ...EMPTY_FILTERS, minPrice: 0 })).toBe("?min=0")
  })
})

describe("toProductFilterInput", () => {
  it("converts major units to integer cents", () => {
    const input = toProductFilterInput({
      ...EMPTY_FILTERS,
      minPrice: 10.5,
      maxPrice: 99.99,
    })
    expect(input.min_price_cents).toBe(1050)
    expect(input.max_price_cents).toBe(9999)
  })

  it("rounds rather than truncating a third decimal", () => {
    expect(
      toProductFilterInput({ ...EMPTY_FILTERS, minPrice: 10.006 }).min_price_cents,
    ).toBe(1001)
  })

  it("expands `in stock only` to both positive buckets", () => {
    // Asking for IN_STOCK alone would hide everything the vendor flagged low,
    // which is still buyable.
    expect(
      toProductFilterInput({ ...EMPTY_FILTERS, inStockOnly: true }).stock_statuses,
    ).toEqual(["IN_STOCK", "LOW_STOCK"])
  })

  it("passes system_category_id when categoryId is provided", () => {
    const input = toProductFilterInput({
      ...EMPTY_FILTERS,
      categoryId: "cat-42",
    })
    expect(input.system_category_id).toBe("cat-42")
  })

  it("omits absent filters instead of sending nulls", () => {
    const input = toProductFilterInput(EMPTY_FILTERS)
    expect(input).toEqual({ page: 1, limit: PAGE_SIZE, sort_by: DEFAULT_SORT })
  })

  it("accepts an explicit page for fetchMore", () => {
    expect(toProductFilterInput(EMPTY_FILTERS, 3).page).toBe(3)
  })
})

describe("catalogHasMore", () => {
  it("is false when meta is missing", () => {
    expect(catalogHasMore(undefined, 0)).toBe(false)
  })

  it("is false for a short catalogue that fits on page 1", () => {
    expect(
      catalogHasMore({ page: 1, total_pages: 1, total: 3 }, 3),
    ).toBe(false)
  })

  it("is false once every row is already loaded", () => {
    expect(
      catalogHasMore({ page: 1, total_pages: 5, total: 3 }, 3),
    ).toBe(false)
  })

  it("is true when more pages remain and the list is still short of total", () => {
    expect(
      catalogHasMore({ page: 1, total_pages: 3, total: 50 }, 24),
    ).toBe(true)
  })

  it("is false on the last page", () => {
    expect(
      catalogHasMore({ page: 3, total_pages: 3, total: 50 }, 50),
    ).toBe(false)
  })
})

describe("activeFilterCount", () => {
  it("ignores search and sort", () => {
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        search: "mug",
        sort: "PRICE_LOW",
      }),
    ).toBe(0)
  })

  it("counts each bound, the stock toggle, category, and every chip", () => {
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        minPrice: 1,
        maxPrice: 2,
        inStockOnly: true,
        tagIds: ["a", "b"],
        collectionIds: ["c"],
        categoryId: "cat-1",
      }),
    ).toBe(7)
  })
})
