"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { GET_MY_SHOPS } from "@/features/shops/api"
import { useActiveShopStore } from "@/shared/stores/active-shop"

/** What `format.ts` already assumes when nobody says otherwise. */
const DEFAULT_CURRENCY = "SAR"

interface MyShopsResult {
  myShops?: {
    data?: Array<{ slug: string; currency?: string | null } | null> | null
  } | null
}

/**
 * The active shop's currency.
 *
 * The slug comes from the URL (`useParams`) and the currency from `MyShops`,
 * which the store layout already preloads. Both are present on the server
 * render and on the first client render, so a price painted with this hook
 * matches. The zustand shop store is the wrong source for that first paint:
 * it starts empty (the server then falls through to SAR) and `hydrate()`
 * copies `active_shop_currency` out of localStorage in an effect. A table
 * that suspends hydrates after that effect, so the client prints ₪ while the
 * HTML still says ر.س.
 *
 * The store is still updated after commit so `formatMoney` callers that do
 * not pass a currency catch up. They should pass this value instead.
 */
export function useShopCurrency(): string {
  const params = useParams<{ shopSlug?: string }>()
  const paramSlug = typeof params?.shopSlug === "string" ? params.shopSlug : null
  const storeSlug = useActiveShopStore((s) => s.slug)
  const slug = paramSlug ?? storeSlug

  const { data } = useSuspenseQuery<MyShopsResult>(GET_MY_SHOPS)
  const shop = slug
    ? data?.myShops?.data?.find((s) => s?.slug === slug)
    : undefined
  const currency = shop?.currency || DEFAULT_CURRENCY

  useEffect(() => {
    if (!shop?.currency) return
    if (useActiveShopStore.getState().currency === shop.currency) return
    useActiveShopStore.getState().setCurrency(shop.currency)
  }, [shop?.currency])

  return currency
}
