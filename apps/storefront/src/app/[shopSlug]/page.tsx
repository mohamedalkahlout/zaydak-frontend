import { Suspense } from "react"

import {
  STOREFRONT_PRODUCTS,
  STOREFRONT_RECOMMENDATIONS,
} from "@/features/catalog/api"
import {
  HOME_FACETS,
  HOME_POPULAR_VARIABLES,
  HOME_RECENT_VARIABLES,
  HOME_TRENDING_VARIABLES,
} from "@/features/shop/api"
import { DoughnStorefrontHome } from "@/features/shop/components/doughn-home"
import { DripStorefrontHome } from "@/features/shop/components/drip-home"
import { HulloStorefrontHome } from "@/features/shop/components/hullo-home"
import { JuratStorefrontHome } from "@/features/shop/components/jurat-home"
import { PersonneStorefrontHome } from "@/features/shop/components/personne-home"
import { RailStorefrontHome } from "@/features/shop/components/rail-home"
import { HomeSkeleton } from "@/features/shop/components/home/home-skeleton"
import { ShopHome } from "@/features/shop/components/shop-home"
import { SheinLinkDrop } from "@/features/shop/components/shein-link-drop"
import { storefrontHomeKind } from "@/features/shop/lib/shop-home"
import {
  fetchShopShell,
  fetchStorefrontPresentation,
} from "@/features/shop/lib/shop-server"
import { PreloadQuery, storefrontContext } from "@/shared/apollo/rsc"
import { serverTenant } from "@/shared/lib/tenant-server"

/**
 * The shop's front page, with its four queries started on the server.
 *
 * `ShopHome` reads all four back with `useSuspenseQuery`, so what the browser
 * receives is the finished page — products, collections, prices — rather than a
 * shell that fetches them after hydration. Every one of these is a public read
 * behind `OptionalJwtGuard`, which is what makes preloading them safe: the
 * server client carries no token, so there is no per-visitor data here to leak
 * into a shared response.
 *
 * **The four `PreloadQuery` wrappers do not run in sequence.** Each one starts
 * its query and returns a reference immediately — it never awaits the network —
 * so nesting them costs nothing and all four are in flight together. They are
 * nested rather than siblings because each has to sit above the component that
 * reads it, and that component is the same one for all four.
 *
 * The `Suspense` boundary is what lets the shop chrome paint before the
 * products arrive. Without it the suspension unwinds past this segment and the
 * whole document waits on the slowest of the four.
 *
 * **A missing / closed shop skips the catalogue preloads.** `ShopHeaderGuard`
 * answers `RESOURCE_NOT_FOUND` for an unknown `X-SHOP`, and `ShopShell` already
 * swaps the page for the closed screen — firing four failing preloads only
 * filled the terminal with noise and never fed a reader.
 */
async function SheinHybridHome({ slug }: { slug: string }) {
  const tenant = await serverTenant(slug)
  return (
    <>
      <SheinLinkDrop base={tenant.base} embedded />
      <ShopHome />
    </>
  )
}

export default async function ShopHomePage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const shop = await fetchShopShell(shopSlug)
  const presentation = await fetchStorefrontPresentation(shopSlug)

  const homeKind = shop ? storefrontHomeKind(presentation?.template) : "default"
  const businessModel = presentation?.businessModel ?? "OWN_PRODUCTS"

  if (businessModel === "SHOPPING_AGENT" && homeKind === "default") {
    const tenant = await serverTenant(shopSlug)
    return <SheinLinkDrop base={tenant.base} />
  }

  if (homeKind === "doughn") {
    const tenant = await serverTenant(shopSlug)
    return (
      <DoughnStorefrontHome
        slug={shopSlug}
        base={tenant.base}
        theme={presentation?.theme}
        currency={presentation?.currency || "SAR"}
        name={presentation?.name}
        timeZone={presentation?.timeZone}
        place={presentation?.place}
      />
    )
  }

  if (homeKind === "drip") {
    return <DripStorefrontHome />
  }

  if (homeKind === "rail") {
    const tenant = await serverTenant(shopSlug)
    return <RailStorefrontHome base={tenant.base} />
  }

  if (homeKind === "hullo") {
    return <HulloStorefrontHome />
  }

  if (homeKind === "personne") {
    return <PersonneStorefrontHome />
  }

  if (homeKind === "jurat") {
    return <JuratStorefrontHome />
  }

  if (!shop) {
    return (
      <Suspense fallback={<HomeSkeleton />}>
        <ShopHome />
      </Suspense>
    )
  }

  const context = await storefrontContext(shopSlug)

  return (
    <PreloadQuery query={HOME_FACETS} context={context}>
      <PreloadQuery
        query={STOREFRONT_PRODUCTS}
        variables={HOME_POPULAR_VARIABLES}
        context={context}
      >
        <PreloadQuery
          query={STOREFRONT_PRODUCTS}
          variables={HOME_RECENT_VARIABLES}
          context={context}
        >
          <PreloadQuery
            query={STOREFRONT_RECOMMENDATIONS}
            variables={HOME_TRENDING_VARIABLES}
            context={context}
          >
            <Suspense fallback={<HomeSkeleton />}>
              {businessModel === "HYBRID" ? (
                <SheinHybridHome slug={shopSlug} />
              ) : (
                <ShopHome />
              )}
            </Suspense>
          </PreloadQuery>
        </PreloadQuery>
      </PreloadQuery>
    </PreloadQuery>
  )
}
