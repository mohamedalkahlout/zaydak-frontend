"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useWatch } from "react-hook-form"
import { PREVIEW_COLLECTION } from "@/features/collections/api"
import { formToRules } from "@/features/collections/lib/rules"
import type {
  CollectionItem,
  CollectionPreviewResponse,
} from "@/features/collections/types"
import type {
  CollectionFormApi,
  CollectionSort,
  SourceInput,
} from "@/features/collections/validations/shop-collection"

const DEBOUNCE_MS = 350

/**
 * What the staged rules select, right now. The query is read-only, so it can
 * run against unsaved edits — which is the point: a condition the vendor
 * cannot see the effect of is a condition they have to save to test.
 *
 * Staged state is folded into one JSON key so the effect depends on the
 * *value* rather than on the array identity `useWatch` hands back each render.
 */
export function useCollectionPreview({
  form,
  page,
  limit,
}: {
  form: CollectionFormApi
  page: number
  limit: number
}) {
  const sources = useWatch({ control: form.control, name: "sources" }) as
    | SourceInput[]
    | undefined
  const productIds = useWatch({
    control: form.control,
    name: "product_ids",
  }) as string[] | undefined
  const sort = useWatch({ control: form.control, name: "sort" }) as
    | CollectionSort
    | undefined

  const key = useMemo(
    () =>
      JSON.stringify({
        rules: formToRules(sources ?? []),
        product_ids: productIds ?? [],
      }),
    [sources, productIds],
  )

  const [settled, setSettled] = useState(key)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(key), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [key])

  const staged = useMemo(
    () => JSON.parse(settled) as { rules: unknown; product_ids: string[] },
    [settled],
  )

  const { data, loading, previousData, error } =
    useQuery<CollectionPreviewResponse>(PREVIEW_COLLECTION, {
      variables: {
        input: {
          rules: staged.rules,
          product_ids: staged.product_ids,
          sort: sort ?? "MOST_RELEVANT",
          page,
          limit,
        },
      },
      fetchPolicy: "cache-and-network",
    })

  const payload = data?.previewCollection ?? previousData?.previewCollection

  return {
    items: (payload?.data ?? []) as CollectionItem[],
    total: payload?.meta.total ?? 0,
    totalPages: payload?.meta.total_pages ?? 1,
    // Keep the last result on screen while the next one loads: the panel
    // re-queries on every keystroke inside a condition, and blanking it each
    // time reads as "your rule broke something".
    loading: loading && !payload,
    refreshing: loading,
    /** True while the debounce has not caught up with the latest edit. */
    stale: settled !== key,
    error,
  }
}
