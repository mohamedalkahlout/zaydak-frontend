import type { StorefrontHomeFacetsQuery } from "@/shared/api/generated/graphql"

/**
 * The rows the front page's merchandising sections are drawn from.
 *
 * Derived from the generated query type rather than re-declared, so a field
 * removed from `HOME_FACETS` breaks the components that read it at `tsc` time
 * instead of rendering blank at runtime. Same reason `catalog/lib/product.ts`
 * derives `ProductCard` from `StorefrontProductsQuery`.
 */

export type HomeCollection =
  StorefrontHomeFacetsQuery["collections"]["data"][number]

export type HomeTag = StorefrontHomeFacetsQuery["tags"]["data"][number]
