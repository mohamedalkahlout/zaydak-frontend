import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { getClient } from "@/shared/lib/apollo"
import { GET_MY_SHOPS, RESOLVE_SHOP_HANDLE } from "@/features/shops/api"
import {
  canonicalStorePath,
  resolveCanonicalSlug,
} from "@/features/shops/lib/canonical-path"
import type {
  MyShopsResponse,
  ResolveShopHandleResponse,
} from "@/features/shops/types"
import { PATHNAME_HEADER } from "@/proxy"

/**
 * Put the dashboard's own URL back on the shop's current handle.
 *
 * `/store/<old>/products` never broke — `ShopHeaderGuard` matches `X-SHOP`
 * against `shop_slug_history` and `shop(slug)` resolves the retired handle —
 * but the dashboard had no idea it was standing on one, and three things read
 * the slug straight off the URL and quietly disagreed: the header's shop
 * switcher found no active shop (no check-mark, no name), `useSettingsShop`
 * fell back to `shops[0]` and edited the wrong store, and `useShopCurrency`
 * matched nothing and priced the screen in the platform default. A bookmark
 * or a second tab kept from before a rename is the ordinary way in.
 *
 * A server layout rather than a client redirect from `DashboardShell`: the
 * client has the shop list and the pathname too, but it would paint a frame
 * under the stale slug first, with the wrong currency in it.
 *
 * 307, not 308 — a handle can be changed again, or changed back, and a
 * permanent redirect cached in every vendor's browser would outlive the
 * decision that caused it. `redirect()` is Next's default.
 */
export default async function ShopScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params

  let canonical: string | null = null
  let isForeignOrNotFound = false

  try {
    // The same request-scoped client the parent layout's `PreloadQuery` uses,
    // so this is a cache hit rather than a second `MyShops` round trip.
    const client = await getClient()
    const { data } = await client.query<MyShopsResponse>({ query: GET_MY_SHOPS })
    const myShops = (data?.myShops?.data ?? []).map(({ id, slug }) => ({
      id,
      slug,
    }))

    // Only ask the server about a handle that is not already one of theirs.
    // Every ordinary navigation stops on this line.
    if (myShops.length > 0 && !myShops.some((shop) => shop.slug === shopSlug)) {
      const { data: resolved } = await client.query<ResolveShopHandleResponse>({
        query: RESOLVE_SHOP_HANDLE,
        variables: { slug: shopSlug },
      })
      canonical = resolveCanonicalSlug({
        shopSlug,
        myShops,
        resolved: resolved?.shop?.data ?? null,
      })
      if (!canonical) {
        // The handle does not belong to any shop the vendor owns.
        isForeignOrNotFound = true
      }
    }
  } catch {
    // A failed read is not a reason to move anyone: the back-end still
    // resolves the old handle, so leaving the URL alone is today's behaviour.
  }

  // Outside the try/catch on purpose — `redirect()` short-circuits by throwing
  // NEXT_REDIRECT, and a catch above it swallows the redirect instead.
  if (canonical) {
    const pathname = (await headers()).get(PATHNAME_HEADER)
    redirect(canonicalStorePath(pathname, shopSlug, canonical))
  }

  if (isForeignOrNotFound) {
    notFound()
  }

  return <>{children}</>
}
