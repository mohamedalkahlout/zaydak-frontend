"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"
import { useActiveShopStore } from "@/shared/stores/active-shop"

/**
 * Drop the Apollo cache whenever the active shop changes.
 *
 * The problem this solves is structural, not per-query. Apollo normalizes a
 * query with no variables under a single `ROOT_QUERY` field key — `AnalyticsTargets`
 * is the same cache entry no matter which shop it was fetched for, because the
 * shop rides in the `X-SHOP` *header*, which the cache cannot see. Switching
 * shops under `cache-and-network` therefore paints the previous shop's numbers
 * for a frame before the network answers.
 *
 * The alternative fix is `typePolicies` with a synthetic shop dimension in
 * `keyArgs` on every shop-scoped root field. That was rejected: it needs every
 * such field enumerated and kept in step forever, and the failure mode of
 * forgetting one is silent and looks exactly like this bug. Evicting on switch
 * is one rule that covers every query, including ones not written yet.
 *
 * `clearStore()` rather than `resetStore()`: resetting refetches every active
 * query against the shop being navigated away from, which is both wasted work
 * and a burst of requests that can land after the route has changed. Switching
 * shops changes the URL, so the screens remount and fetch on their own.
 */
export function ShopCacheBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  const client = useApolloClient()
  const slug = useActiveShopStore((s) => s.slug)
  const previous = useRef<string | null>(null)

  useEffect(() => {
    const wasSet = previous.current !== null
    const changed = previous.current !== slug
    previous.current = slug

    // Skip the first observed value: it is hydration settling, not a switch,
    // and clearing there would throw away the cache the page just filled.
    if (!wasSet || !changed) return

    void client.clearStore()
  }, [client, slug])

  return <>{children}</>
}
