"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useApolloClient } from "@apollo/client/react"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import {
  SHOP_SWITCH_SETTLE_MS,
  inflightTrackerOf,
} from "@/shared/lib/apollo/inflight"

export interface SwitchShopOptions {
  /** Where to land. Defaults to the shop's dashboard home. */
  href?: string
  /** Replace the history entry instead of pushing one. */
  replace?: boolean
}

/** What `useSwitchShop` hands back: move the dashboard to another shop. */
export type SwitchShop = (
  slug: string,
  options?: SwitchShopOptions,
) => Promise<void>

/**
 * The one way to change which shop the dashboard is looking at.
 *
 * Switching shops is not a navigation with a store write next to it — it is a
 * two-system move that has an order, and every call site used to spell that
 * order out for itself (the header menu, the picker, the handle rename). The
 * order:
 *
 * 1. **Let what is out land.** Writing the active-shop store is what
 *    `ShopCacheBoundary` watches, and it answers with `client.clearStore()`,
 *    which rejects everything still in the link chain with "Store reset while
 *    query was in flight". That rejection skips the error link entirely and
 *    surfaces on the reader — thrown at render for a `useSuspenseQuery`, which
 *    is `DashboardShell`'s `GET_ME`/`GET_MY_SHOPS` and 44 page-level queries.
 *    So the switch waits for the chain to go idle first, capped by
 *    `SHOP_SWITCH_SETTLE_MS` so a hung request cannot block the vendor.
 * 2. **Then the store, then the URL — never the other way round.** The Apollo
 *    shop link reads `useActiveShopStore` *first* (`apollo/client.tsx`), so a
 *    push before the write sends the new page's first fetch out under the old
 *    `X-SHOP`.
 *
 * The wait is skipped when nothing is in flight, so the ordinary click still
 * commits in the same tick rather than a microtask later.
 */
export function useSwitchShop(): SwitchShop {
  const router = useRouter()
  const client = useApolloClient()
  const setSlug = useActiveShopStore((s) => s.setSlug)
  const currentSlug = useActiveShopStore((s) => s.slug)

  return useCallback(
    (slug: string, options: SwitchShopOptions = {}) => {
      const href = options.href ?? `/store/${slug}`
      const go = () =>
        options.replace ? router.replace(href) : router.push(href)

      // Same shop: there is no cache to clear, so there is nothing to wait for.
      if (slug === currentSlug) {
        go()
        return Promise.resolve()
      }

      const commit = () => {
        setSlug(slug)
        go()
      }

      const tracker = inflightTrackerOf(client)
      if (!tracker || tracker.pending() === 0) {
        commit()
        return Promise.resolve()
      }
      return tracker.waitForIdle(SHOP_SWITCH_SETTLE_MS).then(commit)
    },
    [client, currentSlug, router, setSlug],
  )
}
