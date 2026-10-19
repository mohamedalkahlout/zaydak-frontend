import { DoughnTemplate } from "@repo/storefront-templates/doughn"
import type { ThemeProductRow } from "@repo/storefront-templates/doughn/theme"

import {
  doughnHomeContent,
  doughnShopFacts,
  type DoughnShopPlace,
} from "@/features/shop/lib/shop-home"
import { DOUGHN_FONTS } from "./doughn-fonts"

import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { storefrontContext } from "@/shared/apollo/rsc"

const PRODUCTS = /* GraphQL */ `
  query DoughnCollectionProducts($filters: ProductFilterInput) {
    storefrontProducts(filters: $filters) {
      success
      data {
        name
        slug
        image
        selling_price_cents
        price_cents
      }
    }
  }
`

async function collectionProducts(
  slug: string,
  collectionId: string,
): Promise<ThemeProductRow[]> {
  try {
    const context = await storefrontContext(slug)
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...context.headers,
      },
      body: JSON.stringify({
        query: PRODUCTS,
        variables: { filters: { collection_ids: [collectionId], limit: 8 } },
      }),
      cache: "no-store",
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { storefrontProducts?: { data?: ThemeProductRow[] | null } | null }
    }
    return json.data?.storefrontProducts?.data ?? []
  } catch {
    return []
  }
}

/**
 * The public home when the shop's template is doughn. It owns the document
 * scroll, so the shop layout renders it without the default header and footer.
 */
export async function DoughnStorefrontHome({
  slug,
  base,
  theme,
  currency,
  name,
  timeZone,
  place,
}: {
  slug: string
  base: string
  theme: unknown
  currency: string
  name?: string | null
  timeZone?: string | null
  place?: DoughnShopPlace | null
}) {
  const settings = (theme ?? null) as { collectionId?: string | null } | null
  const rows = settings?.collectionId
    ? await collectionProducts(slug, settings.collectionId)
    : []
  const content = doughnHomeContent(
    theme,
    rows,
    base,
    currency,
    doughnShopFacts({ name, timeZone, place }),
  )
  return <DoughnTemplate content={content} fonts={DOUGHN_FONTS} />
}
