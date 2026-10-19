import type { ProductFilterInput, ProductSortBy } from "@/shared/api/generated/graphql"

/**
 * The catalogue's filter state lives in the URL, not in React state.
 *
 * That is what makes a filtered view shareable, reloadable and reachable with
 * the back button — the three things a shopper expects of a shop and none of
 * which survive `useState`. This module is the single translation between the
 * query string and `ProductFilterInput`, so a filter is added in one place
 * rather than in the reader, the writer and the chip row separately.
 *
 * Page number is **not** part of the URL. The grid scrolls infinitely; later
 * pages are `fetchMore`'d on the client. A leftover `?page=` from an old link
 * is ignored so the shopper always starts at the top of the list.
 */

export const PAGE_SIZE = 24

export const SORT_OPTIONS = [
  "NEWEST",
  "PRICE_LOW",
  "PRICE_HIGH",
  "MOST_VIEWED",
  "OLDEST",
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]

export const DEFAULT_SORT: SortOption = "NEWEST"

export interface CatalogFilters {
  search: string
  sort: SortOption
  /** Major units as typed by the shopper — cents happen at the boundary. */
  minPrice: number | null
  maxPrice: number | null
  inStockOnly: boolean
  tagIds: string[]
  collectionIds: string[]
  categoryId: string | null
}

export const EMPTY_FILTERS: CatalogFilters = {
  search: "",
  sort: DEFAULT_SORT,
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
  tagIds: [],
  collectionIds: [],
  categoryId: null,
}

function readNumber(raw: string | null): number | null {
  if (!raw) return null
  const value = Number(raw)
  // Guard both NaN and a negative — `Number("")` is 0 and `Number("abc")` is
  // NaN, and either would go out as a real price bound.
  return Number.isFinite(value) && value >= 0 ? value : null
}

function readList(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(",").filter(Boolean)
}

export function readFilters(params: URLSearchParams): CatalogFilters {
  const sortRaw = params.get("sort")

  return {
    search: params.get("search")?.trim() ?? "",
    sort: (SORT_OPTIONS as readonly string[]).includes(sortRaw ?? "")
      ? (sortRaw as SortOption)
      : DEFAULT_SORT,
    minPrice: readNumber(params.get("min")),
    maxPrice: readNumber(params.get("max")),
    inStockOnly: params.get("stock") === "in",
    tagIds: readList(params.get("tags")),
    collectionIds: readList(params.get("collections")),
    categoryId: params.get("category")?.trim() || null,
  }
}

/**
 * Serialize back to a query string, omitting anything at its default.
 *
 * Omission is not cosmetic: `?sort=NEWEST&stock=` in the address bar makes an
 * unfiltered catalogue look filtered, and it gives two URLs for one view, which
 * the Apollo cache would key separately. `page` is never written — scrolling
 * loads more in place.
 */
export function writeFilters(filters: CatalogFilters): string {
  const params = new URLSearchParams()

  if (filters.search) params.set("search", filters.search)
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort)
  if (filters.minPrice !== null) params.set("min", String(filters.minPrice))
  if (filters.maxPrice !== null) params.set("max", String(filters.maxPrice))
  if (filters.inStockOnly) params.set("stock", "in")
  if (filters.tagIds.length) params.set("tags", filters.tagIds.join(","))
  if (filters.collectionIds.length) {
    params.set("collections", filters.collectionIds.join(","))
  }
  if (filters.categoryId) params.set("category", filters.categoryId)

  const query = params.toString()
  return query ? `?${query}` : ""
}

/**
 * Translate to the API's input.
 *
 * The two conversions that matter: **prices become integer cents**, because the
 * API takes `min_price_cents`, and "in stock only" becomes the two positive
 * stock buckets rather than a boolean — `StockStatus` has three values and
 * asking for `IN_STOCK` alone would hide everything the vendor has flagged low.
 *
 * `page` is a separate argument so the suspense query and the preload always
 * ask for page 1 while `fetchMore` can request page 2+.
 */
export function toProductFilterInput(
  filters: CatalogFilters,
  page = 1,
): ProductFilterInput {
  return {
    page,
    limit: PAGE_SIZE,
    sort_by: filters.sort as ProductSortBy,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.minPrice !== null
      ? { min_price_cents: Math.round(filters.minPrice * 100) }
      : {}),
    ...(filters.maxPrice !== null
      ? { max_price_cents: Math.round(filters.maxPrice * 100) }
      : {}),
    ...(filters.inStockOnly
      ? { stock_statuses: ["IN_STOCK" as const, "LOW_STOCK" as const] }
      : {}),
    ...(filters.tagIds.length ? { tag_ids: filters.tagIds } : {}),
    ...(filters.collectionIds.length
      ? { collection_ids: filters.collectionIds }
      : {}),
    ...(filters.categoryId
      ? { system_category_id: filters.categoryId }
      : {}),
  }
}

/** How many filters (not counting search or sort) are active. */
export function activeFilterCount(filters: CatalogFilters): number {
  return (
    (filters.minPrice !== null ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.categoryId !== null ? 1 : 0) +
    filters.tagIds.length +
    filters.collectionIds.length
  )
}

/**
 * Whether the catalogue still has another page to `fetchMore`.
 *
 * Uses both page math and the loaded count. A short catalogue (everything on
 * page 1) must return false immediately — otherwise an always-visible bottom
 * sentinel / InfiniteScroll keeps asking for page 2 forever. Comparing
 * `loadedCount` to `meta.total` also stops the loop when `total_pages` is
 * stale or inflated but the server has already handed over every row.
 */
export function catalogHasMore(
  meta:
    | {
        page: number
        total_pages: number
        total: number
      }
    | null
    | undefined,
  loadedCount: number,
): boolean {
  if (!meta) return false
  if (meta.total_pages <= 0) return false
  if (loadedCount >= meta.total) return false
  return meta.page < meta.total_pages
}

/**
 * Next's `searchParams` as a `URLSearchParams`, so a server component can call
 * `readFilters` on exactly the input the browser gives it.
 *
 * The page preloads the catalogue with the same filters the client is about to
 * ask for, and "the same" has to be literal — `useSuspenseQuery` matches a
 * preload by query *and variables*, so a server-side reading of the query
 * string that differed from `readFilters`' by one coercion would quietly open a
 * second request for the same rows. Funnelling both through one parser is what
 * makes that impossible.
 *
 * A repeated key (`?tags=a&tags=b`) arrives as an array. This app never writes
 * one — `writeFilters` joins lists with commas — but a hand-edited URL can, and
 * dropping the extras rather than stringifying the array keeps `readFilters`
 * seeing a value shaped the way it expects.
 */
export function toSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value)
    else if (Array.isArray(value) && value[0] !== undefined) {
      params.set(key, value[0])
    }
  }
  return params
}
