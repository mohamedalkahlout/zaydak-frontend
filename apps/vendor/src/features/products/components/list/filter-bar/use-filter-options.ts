"use client"

import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import { GET_TAGS } from "@/features/tags/api"
import type { TagsResponse } from "@/features/tags/types"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import type { ShopCollectionsResponse } from "@/features/collections/types"
import { collectionName } from "@/features/collections/lib/list/helpers"
import { GET_PRODUCT_CATEGORIES } from "@/features/products/api"
import type { ProductCategoriesResponse } from "@/features/products/types"
import { translatable } from "@/shared/lib/format"
import {
  PRODUCT_FILTER_KEYS,
  filterValueMessageKey,
  filterValuesOf,
  type ProductFilterKey,
  type ProductFilterOption,
  type ProductFilterSource,
} from "@/features/products/lib/list/filters"
import type { ProductListQueryState } from "@/features/products/lib/list/query-state"

/**
 * A filter wants every tag the shop has, not the form picker's first page —
 * a tag that is not in this list cannot be filtered by. Different variables
 * are a different cache entry regardless, so there is nothing to gain from
 * matching the picker's.
 */
const TAGS_VARIABLES = { page: 1, limit: 200 }
const COLLECTIONS_VARIABLES = { page: 1, limit: 100 }

const byLabel = (a: ProductFilterOption, b: ProductFilterOption) =>
  a.label.localeCompare(b.label)

interface SourceState {
  options: ProductFilterOption[]
  loading: boolean
}

/**
 * The three keys whose values are rows rather than an enum, fetched only when
 * something on screen needs them: the key is the one being edited, or the URL
 * already carries ids for it and a chip has to print their names. The bar is
 * on every visit to the list, and none of these should load for a vendor who
 * only came to scroll.
 *
 * Category reads `productCategories`, not the flat taxonomy the product form
 * picks from. A shop's products sit on a handful of the ~5500 nodes, and the
 * rest can only ever filter to nothing — offering them is a list where almost
 * every row is a dead end. The form needs the whole tree because a product
 * may be filed anywhere; a filter needs what the shop actually sells.
 *
 * `loadingOf` is what lets a chip say "2 selected" instead of two raw ids
 * while its names are still on the wire.
 *
 * The three enum keys are worded here too: the key table holds their values
 * only, and they are labelled in the active locale before anything filters or
 * prints them — narrowing "Stock" by what a merchant typed has to match the
 * words on screen, not the English behind them.
 */
export function useFilterOptions(
  state: ProductListQueryState,
  activeKey: ProductFilterKey | null,
) {
  const t = useTranslations("products")
  const needed = (source: ProductFilterSource) =>
    activeKey?.source === source ||
    PRODUCT_FILTER_KEYS.some(
      (key) => key.source === source && filterValuesOf(state, key).length > 0,
    )

  const needTags = needed("tags")
  const needCollections = needed("collections")
  const needCategories = needed("categories")

  const tags = useQuery<TagsResponse>(GET_TAGS, {
    variables: TAGS_VARIABLES,
    fetchPolicy: "cache-first",
    skip: !needTags,
  })
  const collections = useQuery<ShopCollectionsResponse>(GET_SHOP_COLLECTIONS, {
    variables: COLLECTIONS_VARIABLES,
    fetchPolicy: "cache-first",
    skip: !needCollections,
  })
  const locale = useLocale()
  const categories = useQuery<ProductCategoriesResponse>(
    GET_PRODUCT_CATEGORIES,
    { variables: { locale }, fetchPolicy: "cache-first", skip: !needCategories },
  )

  const tagOptions = useMemo<ProductFilterOption[]>(
    () =>
      (tags.data?.tags?.data ?? [])
        .map((tag) => ({ id: tag.id, label: translatable(tag.name) || tag.slug }))
        .sort(byLabel),
    [tags.data],
  )

  const collectionOptions = useMemo<ProductFilterOption[]>(
    () =>
      (collections.data?.collections?.data ?? [])
        .map((c) => ({ id: c.id, label: collectionName(c.name) || c.slug }))
        .sort(byLabel),
    [collections.data],
  )

  // Server order is kept: `productCategories` returns the shop's own nodes
  // most-used first, which is the order a vendor reaches for them in. Sorting
  // by name here would bury the category most of the catalogue is filed under.
  const categoryOptions = useMemo<ProductFilterOption[]>(
    () =>
      (categories.data?.productCategories?.data ?? []).map((node) => ({
        id: node.id,
        label: node.name,
        hint: node.path,
      })),
    [categories.data],
  )

  // Loading is only true while the rows are actually wanted; a skipped query
  // reports false, so a chip never waits on a fetch that is not happening.
  const tagsLoading = needTags && tags.loading && tagOptions.length === 0
  const collectionsLoading =
    needCollections && collections.loading && collectionOptions.length === 0
  const categoriesLoading =
    needCategories && categories.loading && categoryOptions.length === 0

  return useMemo(() => {
    const sources: Record<ProductFilterSource, SourceState> = {
      tags: { options: tagOptions, loading: tagsLoading },
      collections: { options: collectionOptions, loading: collectionsLoading },
      categories: { options: categoryOptions, loading: categoriesLoading },
    }
    const labels = new Map<ProductFilterSource, Map<string, string>>()
    for (const source of Object.keys(sources) as ProductFilterSource[]) {
      labels.set(
        source,
        new Map(sources[source].options.map((o) => [o.id, o.label])),
      )
    }

    const enumLabel = (key: ProductFilterKey, value: string) =>
      t(filterValueMessageKey(key.id, value))

    const optionsOf = (key: ProductFilterKey): readonly ProductFilterOption[] =>
      key.source
        ? sources[key.source].options
        : key.options.map((id) => ({ id, label: enumLabel(key, id) }))

    /** Falls back to the raw id: a deleted tag still has to render as something the vendor can see and remove. */
    const labelOf = (key: ProductFilterKey, id: string): string => {
      if (key.source) return labels.get(key.source)?.get(id) ?? id
      return key.options.includes(id) ? enumLabel(key, id) : id
    }

    const loadingOf = (key: ProductFilterKey): boolean =>
      key.source ? sources[key.source].loading : false

    return { optionsOf, labelOf, loadingOf }
  }, [
    t,
    tagOptions,
    tagsLoading,
    collectionOptions,
    collectionsLoading,
    categoryOptions,
    categoriesLoading,
  ])
}
