"use client"

import { useMemo } from "react"
import { useLocale } from "next-intl"
import { useQuery } from "@apollo/client/react"
import { GET_SYSTEM_CATEGORIES_FLAT } from "@/features/products/api"
import type { SystemCategoriesFlatResponse } from "@/features/products/types"

export interface CategoryOption {
  id: string
  label: string
  path: string
}

/**
 * The taxonomy, flat, for the category condition. Shared with the product
 * form's picker — same query, same `cache-first` policy, so opening a
 * condition after editing a product costs nothing.
 */
export function useCategoryOptions() {
  const locale = useLocale()
  const { data, loading } = useQuery<SystemCategoriesFlatResponse>(
    GET_SYSTEM_CATEGORIES_FLAT,
    { variables: { locale }, fetchPolicy: "cache-first" },
  )

  const options = useMemo<CategoryOption[]>(
    () =>
      (data?.systemCategoriesFlat?.data ?? []).map((node) => ({
        id: node.id,
        label: node.name ?? node.slug,
        path: node.path ?? "",
      })),
    [data],
  )

  const byId = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  )

  return {
    options,
    loading,
    /** Falls back to the raw id: a category deleted from the taxonomy still
     *  has to render as something the vendor can see and remove. */
    labelOf: (id: string) => byId.get(id)?.label ?? id,
  }
}
