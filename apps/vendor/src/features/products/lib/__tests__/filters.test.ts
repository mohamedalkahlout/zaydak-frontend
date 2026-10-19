import { describe, it, expect } from "vitest"
import {
  PRODUCT_FILTER_KEYS,
  activeFilterKeys,
  filterPatch,
  filterValueMessageKey,
  filterValuesOf,
  findFilterKey,
} from "../list/filters"
import type { ProductListQueryState } from "../list/query-state"
import { enTranslator } from "@/shared/test/next-intl"

/** The words a key and its values read, from the real English catalogue. */
const t = enTranslator("products")

// The filter bar's key table is declarative, and these pin the two rules the
// bar leans on: a key is exactly one query-state field, and a patch built for
// it has the shape that field expects — an array for a multi-select key, a
// bare string for the single-select one, `undefined` to clear either.

const base: ProductListQueryState = { page: 1, limit: 6 }

const key = (id: string) => {
  const found = findFilterKey(id)
  if (!found) throw new Error(`no filter key ${id}`)
  return found
}

describe("PRODUCT_FILTER_KEYS", () => {
  it("lists the keys in the order the dropdown shows them, without Status", () => {
    expect(PRODUCT_FILTER_KEYS.map((k) => k.id)).toEqual([
      "tag",
      "category",
      "collection",
      "product_type",
      "sale_type",
      "stock",
    ])
    // Status is the view selector's; a second control over `statuses` would
    // be two places to look for what the list is showing.
    expect(
      PRODUCT_FILTER_KEYS.some(
        (k) => t(`filters.keys.${k.id}.label`) === "Status",
      ),
    ).toBe(false)
  })

  // The table carries no words, so a key or an enum value with no message
  // would reach the screen as a raw id. Every one is asserted to resolve.
  it("words every key and every enum value from the catalogue", () => {
    expect(PRODUCT_FILTER_KEYS.map((k) => t(`filters.keys.${k.id}.label`))).toEqual([
      "Tag",
      "Category",
      "Collection",
      "Type",
      "Selling method",
      "Stock",
    ])
    const values = PRODUCT_FILTER_KEYS.flatMap((k) =>
      (k.options ?? []).map((v) => t(filterValueMessageKey(k.id, v))),
    )
    expect(values).toEqual([
      "Simple",
      "Variable",
      "Digital",
      "Service",
      "Fixed price",
      "Negotiable",
      "Auction",
      "In stock",
      "Low stock",
      "Out of stock",
    ])
  })

  it("maps every key to a distinct query-state field", () => {
    const fields = PRODUCT_FILTER_KEYS.map((k) => k.field)
    expect(new Set(fields).size).toBe(fields.length)
  })

  it("carries either static options or a source, never both", () => {
    for (const k of PRODUCT_FILTER_KEYS) {
      expect(!!k.options !== !!k.source).toBe(true)
    }
  })

  it("makes Category the one single-select key", () => {
    expect(PRODUCT_FILTER_KEYS.filter((k) => !k.multiple).map((k) => k.id)).toEqual([
      "category",
    ])
  })
})

describe("filterValuesOf", () => {
  it("reads an array field as-is and an absent one as empty", () => {
    expect(filterValuesOf({ ...base, tag_ids: ["t1", "t2"] }, key("tag"))).toEqual(
      ["t1", "t2"],
    )
    expect(filterValuesOf(base, key("tag"))).toEqual([])
  })

  it("wraps the single-select string in an array", () => {
    expect(
      filterValuesOf({ ...base, system_category_id: "c1" }, key("category")),
    ).toEqual(["c1"])
    expect(filterValuesOf(base, key("category"))).toEqual([])
  })

  it("returns a copy, not the state's own array", () => {
    const state = { ...base, product_types: ["SIMPLE" as const] }
    const values = filterValuesOf(state, key("product_type"))
    values.push("DIGITAL")
    expect(state.product_types).toEqual(["SIMPLE"])
  })
})

describe("filterPatch", () => {
  it("writes an array for a multi-select key", () => {
    expect(filterPatch(key("tag"), ["t1", "t2"])).toEqual({ tag_ids: ["t1", "t2"] })
  })

  it("writes a bare string for the single-select key", () => {
    expect(filterPatch(key("category"), ["c1"])).toEqual({
      system_category_id: "c1",
    })
    // Several ids to a single-select key keep only the first.
    expect(filterPatch(key("category"), ["c1", "c2"])).toEqual({
      system_category_id: "c1",
    })
  })

  it("clears the field with undefined when there is nothing left", () => {
    expect(filterPatch(key("tag"), [])).toEqual({ tag_ids: undefined })
    expect("tag_ids" in filterPatch(key("tag"), [])).toBe(true)
    expect(filterPatch(key("category"), [])).toEqual({
      system_category_id: undefined,
    })
  })

  it("drops duplicates and blanks so the URL never carries them", () => {
    expect(filterPatch(key("tag"), ["t1", " ", "t1", ""])).toEqual({
      tag_ids: ["t1"],
    })
    expect(filterPatch(key("tag"), ["", "  "])).toEqual({ tag_ids: undefined })
  })
})

describe("activeFilterKeys", () => {
  it("returns the keys with values, in key order regardless of state order", () => {
    const state: ProductListQueryState = {
      ...base,
      stock_statuses: ["IN_STOCK"],
      tag_ids: ["t1"],
      system_category_id: "c1",
    }
    expect(activeFilterKeys(state).map((k) => k.id)).toEqual([
      "tag",
      "category",
      "stock",
    ])
  })

  it("ignores the search and the statuses the view selector owns", () => {
    expect(
      activeFilterKeys({ ...base, search: "mug", statuses: ["DRAFT"] }),
    ).toEqual([])
  })
})
