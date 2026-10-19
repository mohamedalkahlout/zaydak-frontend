import { Suspense } from "react"
import type { Metadata } from "next"

import { CATALOG_FACETS, STOREFRONT_PRODUCTS } from "@/features/catalog/api"
import { CatalogPage } from "@/features/catalog/components/catalog-page"
import { CatalogSkeleton } from "@/features/catalog/components/catalog-skeleton"
import {
  readFilters,
  toProductFilterInput,
  toSearchParams,
} from "@/features/catalog/lib/filters"
import { fetchShopShell } from "@/features/shop/lib/shop-server"
import { PreloadQuery, storefrontContext } from "@/shared/apollo/rsc"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}): Promise<Metadata> {
  const { shopSlug } = await params
  const shop = await fetchShopShell(shopSlug)
  const shopName = shop?.name || "Shop"
  const title = `${shopName} — Products`
  const description = `Browse all products and collections from ${shopName}.`

  return {
    title,
    description,
    alternates: {
      // The shop's own address, built from its CURRENT handle and its
      // promoted domain: a canonical pointing at a URL that 307s or 308s is a
      // canonical pointing nowhere.
      canonical: `${await canonicalShopBase(shop?.slug ?? shopSlug)}/products`,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
  }
}

/**
 * The catalogue, rendered against the filters in the URL.
 *
 * Reading `searchParams` here is what makes a *filtered* link server-rendered
 * too, not just the bare `/products`. Both this and `CatalogPage` derive their
 * variables through the same `readFilters` + `toProductFilterInput` pair, which
 * is the only reason the client's `useSuspenseQuery` matches this preload
 * instead of quietly opening its own request for the same rows. Always page 1:
 * later pages are `fetchMore`'d on the client for infinite scroll.
 *
 * `CatalogPage` reads `useSearchParams`, which is why it stayed behind a
 * `Suspense` boundary when the page was static — the boundary now earns its
 * keep twice over, since it is also what lets the shop chrome paint while the
 * products stream in behind it.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ shopSlug }, rawSearch] = await Promise.all([params, searchParams])
  const context = await storefrontContext(shopSlug)
  const filters = readFilters(toSearchParams(rawSearch))

  return (
    <PreloadQuery
      query={STOREFRONT_PRODUCTS}
      variables={{ filters: toProductFilterInput(filters) }}
      context={context}
    >
      <PreloadQuery query={CATALOG_FACETS} context={context}>
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogPage />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}
