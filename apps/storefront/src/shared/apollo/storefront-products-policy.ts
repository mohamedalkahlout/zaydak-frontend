import type { FieldFunctionOptions, Reference } from "@apollo/client"

/**
 * Cache policy for `storefrontProducts`.
 *
 * The catalogue scrolls infinitely: later pages are `fetchMore`'d into the same
 * cache entry and concatenated. `page` is deliberately **not** a key arg — if it
 * were, page 2 would be a second entry and the grid would replace rather than
 * grow. Every other filter field is keyed, so a stock toggle or a sort change
 * opens a fresh list instead of appending across filters.
 *
 * Shared by the browser client and the RSC client so a preloaded first page and
 * the same read after hydration normalize to one entry.
 */
export const STOREFRONT_PRODUCTS_FILTER_KEY_ARGS = [
  "ids",
  "shop_ids",
  "statuses",
  "product_types",
  "sale_types",
  "tag_ids",
  "stock_statuses",
  "search",
  "min_price_cents",
  "max_price_cents",
  "sort_by",
  "limit",
  "system_category_id",
  "collection_ids",
  "attribute_filters",
] as const

type ProductsField = {
  success?: boolean
  data?: ReadonlyArray<Reference | Record<string, unknown>>
  meta?: {
    page?: number
    limit?: number
    total?: number
    total_pages?: number
  } | null
  __typename?: string
}

function itemKey(item: Reference | Record<string, unknown>): string | unknown {
  if (item && typeof item === "object" && "__ref" in item) {
    return (item as Reference).__ref
  }
  if (item && typeof item === "object" && "id" in item) {
    return (item as { id: unknown }).id
  }
  return item
}

/**
 * Concatenate pages when `filters.page` > 1; replace on page 1 (filter change
 * or a fresh preload). Dedupes by cache ref / id so a repeated page cannot
 * double a tile.
 */
export function mergeStorefrontProducts(
  existing: ProductsField | undefined,
  incoming: ProductsField,
  { args }: FieldFunctionOptions,
): ProductsField {
  const page =
    (args?.filters as { page?: number } | null | undefined)?.page ?? 1
  if (!existing || page <= 1) return incoming

  const existingData = existing.data ?? []
  const incomingData = incoming.data ?? []
  const seen = new Set(existingData.map(itemKey))
  const appended = incomingData.filter((item) => !seen.has(itemKey(item)))

  // Prefer the farthest page we have merged so `catalogHasMore` can flip
  // false even if a later write omits `meta.page`.
  const existingPage = existing.meta?.page ?? 1
  const incomingPage = incoming.meta?.page ?? page

  return {
    ...incoming,
    data: [...existingData, ...appended],
    meta: {
      ...incoming.meta,
      page: Math.max(existingPage, incomingPage),
    },
  }
}

export const storefrontProductsFieldPolicy = {
  keyArgs: ["filters", [...STOREFRONT_PRODUCTS_FILTER_KEY_ARGS]],
  merge: mergeStorefrontProducts,
}
