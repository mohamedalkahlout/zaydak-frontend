import {
  PRODUCT_TYPE_OPTIONS,
  SALE_TYPE_OPTIONS,
  STOCK_OPTIONS,
} from "./constants"
import type { ProductListQueryState } from "./query-state"

/**
 * The keys the filter bar offers, in the order its dropdown lists them.
 *
 * Each key is one field of `ProductListQueryState` and nothing else: the URL
 * stays the single source of truth, the bar only reads and writes it, and a
 * chip is whatever the URL currently says. Status is deliberately not here —
 * the "All" view selector already owns `statuses`, and `constants.ts` says
 * why one piece of state gets one control.
 *
 * "Is not" is not offered either. The back-end's `ProductFilterInput` has no
 * exclusion fields, so an operator picker would be a promise the query cannot
 * keep.
 */
export type ProductFilterKeyId =
  | "tag"
  | "category"
  | "collection"
  | "product_type"
  | "sale_type"
  | "stock"

/** The query-state field a key writes. */
export type ProductFilterField =
  | "tag_ids"
  | "system_category_id"
  | "collection_ids"
  | "product_types"
  | "sale_types"
  | "stock_statuses"

/** Where a key's values come from when they are rows rather than an enum. */
export type ProductFilterSource = "tags" | "collections" | "categories"

/**
 * One value as the bar draws it. For a source key the label is the row's own
 * name (a tag, a collection, a category); for an enum key it is the enum's
 * message, resolved by `useFilterOptions`.
 */
export interface ProductFilterOption {
  id: string
  label: string
  /** Secondary text the search also matches — a category's path. */
  hint?: string
}

/**
 * A key carries no words of its own. What the key row and the chip read
 * ("Tag is …") and the empty rows ("No tags yet") are
 * `products.filters.keys.<id>.*`, whole sentences per key rather than a plural
 * noun dropped into a template — the Arabic for "No tags yet" is not the
 * Arabic for "No" followed by the Arabic for "tags".
 */
interface ProductFilterKeyBase {
  id: ProductFilterKeyId
  field: ProductFilterField
  /** Several values OR-ed (a `string[]` field) or exactly one (a `string`). */
  multiple: boolean
}

export type ProductFilterKey =
  | (ProductFilterKeyBase & {
      /** The enum values offered, in menu order. */
      options: readonly string[]
      source?: undefined
    })
  | (ProductFilterKeyBase & {
      source: ProductFilterSource
      options?: undefined
    })

export const PRODUCT_FILTER_KEYS: readonly ProductFilterKey[] = [
  {
    id: "tag",
    field: "tag_ids",
    multiple: true,
    source: "tags",
  },
  {
    id: "category",
    field: "system_category_id",
    // One node, expanded to its descendants server-side — the filter input
    // takes a single id, so the chip can only ever carry one.
    multiple: false,
    source: "categories",
  },
  {
    id: "collection",
    field: "collection_ids",
    multiple: true,
    source: "collections",
  },
  {
    id: "product_type",
    field: "product_types",
    multiple: true,
    options: PRODUCT_TYPE_OPTIONS,
  },
  {
    id: "sale_type",
    field: "sale_types",
    multiple: true,
    options: SALE_TYPE_OPTIONS,
  },
  {
    id: "stock",
    field: "stock_statuses",
    multiple: true,
    options: STOCK_OPTIONS,
  },
]

/**
 * The message key of an enum key's value, relative to `products`. Each enum
 * reads the vocabulary the rest of the dashboard already uses for it, so the
 * Selling method filter and the form's Selling method field cannot disagree.
 */
export function filterValueMessageKey(
  key: ProductFilterKeyId,
  value: string,
): string {
  switch (key) {
    case "product_type":
      return `productTypes.${value}`
    case "sale_type":
      return `organization.saleType.${value}`
    case "stock":
      return `stockStatus.${value}`
    default:
      // A source key has no enum: its values are row ids with names of their
      // own, and nothing calls this for one. Returned as-is to stay total.
      return value
  }
}

export function findFilterKey(id: string): ProductFilterKey | undefined {
  return PRODUCT_FILTER_KEYS.find((key) => key.id === id)
}

/** The ids the URL currently holds for a key — always an array, even for a single-select key. */
export function filterValuesOf(
  state: ProductListQueryState,
  key: ProductFilterKey,
): string[] {
  const raw = state[key.field]
  if (typeof raw === "string") return raw ? [raw] : []
  return raw ? [...raw] : []
}

/**
 * The state patch that sets a key to `values`. Empty clears the field
 * (`undefined`, which `updateQuery` turns into a deleted param); a
 * single-select key writes its one value as a string, everything else the
 * array. Duplicates and blanks are dropped so the URL never carries them.
 */
export function filterPatch(
  key: ProductFilterKey,
  values: string[],
): Partial<ProductListQueryState> {
  const unique = Array.from(
    new Set(values.map((v) => v.trim()).filter((v) => v.length > 0)),
  )
  if (unique.length === 0) return { [key.field]: undefined }
  const value = key.multiple ? unique : unique[0]
  // The field is a union of array and string fields; the branch above is
  // what keeps the value shape right for whichever one `key.field` is.
  return { [key.field]: value } as Partial<ProductListQueryState>
}

/** Every key with at least one value, in the bar's key order. */
export function activeFilterKeys(
  state: ProductListQueryState,
): ProductFilterKey[] {
  return PRODUCT_FILTER_KEYS.filter(
    (key) => filterValuesOf(state, key).length > 0,
  )
}
