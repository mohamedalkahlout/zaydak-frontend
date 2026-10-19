import type { ProductFilterInput, ProductSortBy, ProductStatus, ProductType, SaleType, StockStatus } from "@/features/products/types"

export const PRODUCT_STATUS_FILTER_VALUES: ProductStatus[] = [
  "DRAFT",
  "PUBLISH",
  "UNLISTED",
]

export const PRODUCT_TYPE_FILTER_VALUES: ProductType[] = [
  "SIMPLE",
  "VARIABLE",
  "DIGITAL",
  "SERVICE",
]

export const SALE_TYPE_FILTER_VALUES: SaleType[] = [
  "FIXED_PRICE",
  "NEGOTIABLE",
  "AUCTION",
]

export const PRODUCT_STOCK_FILTER_VALUES: StockStatus[] = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
]

export const PRODUCT_SORT_VALUES: ProductSortBy[] = [
  "NEWEST",
  "OLDEST",
  "PRICE_LOW",
  "PRICE_HIGH",
  "MOST_VIEWED",
]

export interface ProductListQueryState {
  page: number
  limit: number
  search?: string
  statuses?: ProductStatus[]
  product_types?: ProductType[]
  sale_types?: SaleType[]
  stock_statuses?: StockStatus[]
  collection_ids?: string[]
  tag_ids?: string[]
  /** One taxonomy node; the back-end widens it to the node's descendants. */
  system_category_id?: string
  min_price_cents?: number
  max_price_cents?: number
  sort_by?: ProductSortBy
}

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function firstValue(
  input: SearchParamsInput,
  key: string,
): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined
  }
  const value = input[key]
  return Array.isArray(value) ? value[0] : value
}

function allValues(input: SearchParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) {
    return input.getAll(key)
  }
  const value = input[key]
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInt(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.floor(parsed)
}

function filterValid<T extends string>(
  values: readonly T[],
  inputs: string[],
): T[] {
  const allowed = new Set<string>(values)
  return inputs.filter((v): v is T => allowed.has(v))
}

/**
 * Parse multi-select filters from URL search params. Supports three shapes
 * per key: repeated (`?statuses=DRAFT&statuses=PUBLISH`), comma-separated
 * (`?statuses=DRAFT,PUBLISH`), and the deprecated singular (`?status=DRAFT`).
 */
function parseMulti<T extends string>(
  searchParams: SearchParamsInput,
  pluralKey: string,
  singularKey: string,
  values: readonly T[],
): T[] | undefined {
  const raw = [
    ...allValues(searchParams, pluralKey),
    ...allValues(searchParams, singularKey),
  ]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.toUpperCase())

  if (raw.length === 0) return undefined
  const valid = filterValid(values, raw)
  return valid.length > 0 ? Array.from(new Set(valid)) : undefined
}

function parseEnum<T extends string>(
  value: string | undefined,
  values: readonly T[],
): T | undefined {
  if (!value) return undefined
  const upper = value.toUpperCase()
  return values.includes(upper as T) ? (upper as T) : undefined
}

export function parseProductListQueryState(
  searchParams: SearchParamsInput,
  defaultLimit: number,
): ProductListQueryState {
  const rawPage = firstValue(searchParams, "page")
  const rawSearch = firstValue(searchParams, "search")?.trim()
  const rawCategoryId = firstValue(searchParams, "system_category_id")?.trim()

  return {
    page: parsePositiveInt(rawPage, 1),
    limit: defaultLimit,
    search: rawSearch ? rawSearch : undefined,
    statuses: parseMulti(
      searchParams,
      "statuses",
      "status",
      PRODUCT_STATUS_FILTER_VALUES,
    ),
    product_types: parseMulti(
      searchParams,
      "product_types",
      "product_type",
      PRODUCT_TYPE_FILTER_VALUES,
    ),
    sale_types: parseMulti(
      searchParams,
      "sale_types",
      "sale_type",
      SALE_TYPE_FILTER_VALUES,
    ),
    stock_statuses: parseMulti(
      searchParams,
      "stock_statuses",
      "stock_status",
      PRODUCT_STOCK_FILTER_VALUES,
    ),
    collection_ids:
      allValues(searchParams, "collection_ids").length > 0
        ? Array.from(new Set(allValues(searchParams, "collection_ids")))
        : undefined,
    tag_ids:
      allValues(searchParams, "tag_ids").length > 0
        ? Array.from(new Set(allValues(searchParams, "tag_ids")))
        : undefined,
    system_category_id: rawCategoryId ? rawCategoryId : undefined,
    min_price_cents: parseNonNegativeInt(firstValue(searchParams, "min_price_cents")),
    max_price_cents: parseNonNegativeInt(firstValue(searchParams, "max_price_cents")),
    sort_by: parseEnum(firstValue(searchParams, "sort_by"), PRODUCT_SORT_VALUES),
  }
}

/**
 * Build the GraphQL `ProductFilterInput` payload from the parsed URL
 * state. Enum arrays are already upper-case, so no extra mapping needed.
 */
export function toProductListVariables(
  state: ProductListQueryState,
): { filters: ProductFilterInput } {
  return {
    filters: {
      page: state.page,
      limit: state.limit,
      search: state.search,
      statuses: state.statuses,
      product_types: state.product_types,
      sale_types: state.sale_types,
      stock_statuses: state.stock_statuses,
      collection_ids: state.collection_ids,
      tag_ids: state.tag_ids,
      system_category_id: state.system_category_id,
      min_price_cents: state.min_price_cents,
      max_price_cents: state.max_price_cents,
      sort_by: state.sort_by ?? "NEWEST",
    },
  }
}
