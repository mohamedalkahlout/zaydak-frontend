"use client"

import { startTransition, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PAGE_SIZE } from "@/features/products/lib/list/constants"
import {
  type ProductListQueryState,
  parseProductListQueryState,
} from "@/features/products/lib/list/query-state"

export type UpdateProductListQuery = (
  patch: Partial<ProductListQueryState>,
  opts?: { resetPage?: boolean },
) => void

/** The last URL this hook wrote, and the ones the router may still show before it lands. */
interface PendingWrite {
  /** The committed URL when the chain of writes began, then each written URL an earlier write in the chain may land on. */
  seen: string[]
  to: string
}

/**
 * The products list's query state, read from the URL and written back to it.
 *
 * There are two states here, not one, and the gap between them is the whole
 * reason this is a hook rather than a few lines in the table. A write is a
 * `router.replace` inside a transition, and the list reads `GET_PRODUCTS`
 * with `useSuspenseQuery`, so React keeps the previous tree on screen — the
 * old `searchParams`, the old `queryState` — until the new products arrive,
 * one network round-trip later. Anything computed from the committed URL in
 * that window is computed from the state *before* the last write: two tag
 * toggles inside a round-trip keep only the second, a view change followed
 * by a toggle drops the view, and a checkbox does not tick until the
 * refetch lands, which reads as "nothing happened" and earns a second click.
 *
 * So the hook remembers the last URL it wrote (`pending`) until the router
 * catches up, and both the next write and what the toolbar shows are based
 * on it. `queryState` stays the committed one — it is what the products on
 * screen were fetched with, and the empty state must agree with the rows.
 *
 * `pending` is reconciled during render rather than in an effect: it clears
 * when its own URL lands, and when the URL becomes anything it has no
 * reason to expect — the vendor went somewhere else (back button) and the
 * optimistic state would be a lie. What it expects is the URL the chain of
 * writes began from plus every URL an earlier write in the chain may still
 * land on: a second write while one is in flight is built from the first's
 * URL, and the first landing must not clear it and briefly show the state
 * in between.
 */
export function useProductListQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const committed = searchParams.toString()

  const queryState = useMemo(
    () => parseProductListQueryState(searchParams, PAGE_SIZE),
    [searchParams],
  )

  const [pending, setPending] = useState<PendingWrite | null>(null)
  if (pending && (committed === pending.to || !pending.seen.includes(committed))) {
    setPending(null)
  }

  const shownState = useMemo(
    () =>
      pending
        ? parseProductListQueryState(new URLSearchParams(pending.to), PAGE_SIZE)
        : queryState,
    [pending, queryState],
  )

  const updateQuery: UpdateProductListQuery = (
    patch,
    { resetPage = false } = {},
  ) => {
    // Build on what was last written, not on what has committed, so a write
    // inside the previous one's round-trip carries it rather than undoing it.
    const base = pending?.to ?? committed
    const params = new URLSearchParams(base)
    const baseState = pending ? shownState : queryState

    const nextPage = resetPage ? 1 : (patch.page ?? baseState.page)
    params.set("page", String(nextPage))

    const pick = <K extends keyof ProductListQueryState>(key: K) =>
      key in patch ? patch[key] : baseState[key]

    const nextSearch = pick("search") as string | undefined
    const nextStatuses = pick("statuses") as string[] | undefined
    const nextProductTypes = pick("product_types") as string[] | undefined
    const nextSaleTypes = pick("sale_types") as string[] | undefined
    const nextStockStatuses = pick("stock_statuses") as string[] | undefined
    const nextCollectionIds = pick("collection_ids") as string[] | undefined
    const nextTagIds = pick("tag_ids") as string[] | undefined
    const nextCategoryId = pick("system_category_id") as string | undefined
    const nextSortBy = pick("sort_by") as string | undefined

    if (nextSearch) params.set("search", nextSearch)
    else params.delete("search")

    if (nextSortBy) params.set("sort_by", nextSortBy)
    else params.delete("sort_by")

    if (nextCategoryId) params.set("system_category_id", nextCategoryId)
    else params.delete("system_category_id")

    // Deprecated singular keys — drop on any update so URLs normalize.
    params.delete("status")
    params.delete("product_type")
    params.delete("sale_type")
    params.delete("stock_status")

    const setMulti = (key: string, values?: string[]) => {
      params.delete(key)
      if (values && values.length > 0) {
        for (const v of values) params.append(key, v)
      }
    }

    setMulti("statuses", nextStatuses)
    setMulti("product_types", nextProductTypes)
    setMulti("sale_types", nextSaleTypes)
    setMulti("stock_statuses", nextStockStatuses)
    setMulti("collection_ids", nextCollectionIds)
    setMulti("tag_ids", nextTagIds)

    const next = params.toString()
    // The same URL is not a write: nothing will land to clear it.
    if (next === base) return

    setPending({
      seen: pending ? [...pending.seen, pending.to] : [committed],
      to: next,
    })
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname)
    })
  }

  return { queryState, shownState, updateQuery }
}
