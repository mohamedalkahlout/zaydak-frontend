import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { getClient } from "@/shared/lib/apollo"
import { GET_MY_SHOPS, RESOLVE_SHOP_HANDLE } from "@/features/shops/api"
import {
  canonicalPlanPath,
  resolveCanonicalSlug,
} from "@/features/shops/lib/canonical-path"
import type {
  MyShopsResponse,
  ResolveShopHandleResponse,
} from "@/features/shops/types"
import { PATHNAME_HEADER } from "@/proxy"
import { PlanShell } from "@/features/plan"

/**
 * The chrome the four plan routes share: the way back, what the store is on,
 * the tabs, and any alert about the subscription.
 *
 * In the layout rather than in each page because the alert has to be visible
 * from every tab — a failed card is not news that belongs only on the billing
 * page — and because the return from Stripe lands on whichever URL the session
 * was opened from.
 *
 * Put the plan URL back on the shop's current handle when arriving via a
 * retired handle.
 */
export default async function ShopPlanLayout({
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
    const client = await getClient()
    const { data } = await client.query<MyShopsResponse>({ query: GET_MY_SHOPS })
    const myShops = (data?.myShops?.data ?? []).map(({ id, slug }) => ({
      id,
      slug,
    }))

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
        isForeignOrNotFound = true
      }
    }
  } catch {
    // A failed read is not a reason to move anyone: leaving the URL alone.
  }

  if (canonical) {
    const pathname = (await headers()).get(PATHNAME_HEADER)
    redirect(canonicalPlanPath(pathname, shopSlug, canonical))
  }

  if (isForeignOrNotFound) {
    notFound()
  }

  return <PlanShell>{children}</PlanShell>
}
