import "server-only"

import { cache } from "react"

import { STOREFRONT_PRODUCT_META } from "@/features/catalog/api"
import { getClient, storefrontContext } from "@/shared/apollo/rsc"
import type { StorefrontProductMetaQuery } from "@/shared/api/generated/graphql"

export type ProductMeta = NonNullable<
  StorefrontProductMetaQuery["storefrontProduct"]["data"]
>

/**
 * A server-side read of one product, for the two decisions that happen before
 * the page renders: what the document metadata says, and whether this URL is a
 * product at all.
 *
 * It is wrapped in React's `cache()` because Next calls `generateMetadata` and
 * the page component in the same request, and both want the same answer. One
 * call, two readers — without it a shared product link would cost two identical
 * round trips before a single tile was drawn.
 *
 * A missing product resolves to `null` rather than throwing. `storefrontProduct`
 * answers NOT_FOUND for a slug that does not exist, is not published, or
 * belongs to another shop, and all three mean the same thing to a visitor: this
 * is not a product page. The caller turns that into a real 404.
 */
export const fetchProductMeta = cache(
  async (shopSlug: string, slug: string): Promise<ProductMeta | null> => {
    try {
      const { data } = await getClient().query({
        query: STOREFRONT_PRODUCT_META,
        variables: { slug },
        context: await storefrontContext(shopSlug),
        // Return the NOT_FOUND as an error field instead of throwing it, so a
        // closed product is a value this function can report rather than an
        // exception every caller has to guard.
        errorPolicy: "all",
      })
      return data?.storefrontProduct.data ?? null
    } catch {
      // A network failure must never be the reason a product page 500s — the
      // page still renders, it just renders without a tailored share card.
      return null
    }
  },
)
