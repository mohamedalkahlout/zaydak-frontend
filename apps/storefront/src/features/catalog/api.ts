import { gql } from "@/shared/api/generated"

/**
 * Catalogue operations.
 *
 * Every one of these is a `storefront*` query — the *public* code path, not the
 * `products` query the vendor dashboard uses. That matters beyond permissions:
 * `PublicProduct` deliberately omits `cost_per_item_cents`, `sold_quantity`,
 * bid floors and `ai_keywords`, so there is no shape of this app that can leak
 * them by over-selecting. Reaching for `products` here to get one extra field
 * would quietly opt the storefront out of that guarantee.
 *
 * The shop scope arrives as the `X-SHOP` header (see `shared/apollo/links.ts`),
 * which is why no operation here takes a shop argument.
 *
 * The shared field lists are **GraphQL fragments, not template strings**.
 * `graphql-codegen` extracts `gql()` arguments statically, so a `${...}` inside
 * one is invisible to it — the operation silently generates no types and the
 * document falls back to `unknown`. A fragment is the supported way to share
 * a selection set, and codegen stitches it in by name.
 */

/**
 * The fields a product tile needs, and nothing more.
 *
 * `description` and `tags` are here because the tile lays its caption over the
 * photo and shows the first two lines of one and the first of the other. Both
 * come off the same row the listing already reads (`publicProductSelect`
 * includes the tag join), so the cost is payload, not a query.
 *
 * `gallery` is here for the tile's hover gallery. It is the same JSON column
 * `image` comes from and it is already in `publicProductSelect` and in the
 * public mapper, so a second angle on a product costs a field on this
 * selection set rather than a round trip. The tile draws at most four of them
 * and fetches none until the shopper asks; see `CardPhotos`.
 */
export const PRODUCT_CARD_FRAGMENT = gql(`
  fragment ProductCardFields on PublicProduct {
    id
    name
    slug
    image
    gallery
    description
    tags { id name slug }
    price_cents
    sale_price_cents
    selling_price_cents
    compare_at_price_cents
    min_price_cents
    max_price_cents
    product_type
    in_stock
    quantity
    track_quantity
    continue_selling_when_out_of_stock
  }
`)

export const STOREFRONT_PRODUCTS = gql(`
  query StorefrontProducts($filters: ProductFilterInput) {
    storefrontProducts(filters: $filters) {
      success
      data {
        ...ProductCardFields
      }
      meta {
        page
        limit
        total
        total_pages
      }
    }
  }
`)

export const STOREFRONT_PRODUCT = gql(`
  query StorefrontProduct($slug: String!) {
    storefrontProduct(slug: $slug) {
      success
      data {
        ...ProductCardFields
        video
        sku
        barcode
        brand
        views
        is_digital
        requires_shipping
        weight_grams
        weight_unit_display
        country_of_origin
        sale_type
        seo_title
        seo_description
        shop { id name slug }
        collections { id name slug }
        attributes {
          key
          name
          type
          unit
          value
          display_value
        }
        option_definitions {
          name
          position
          values { label }
        }
        variation_options {
          id
          title
          options
          sku
          image
          price_cents
          sale_price_cents
          selling_price_cents
          compare_at_price_cents
          quantity
          is_disable
          position
        }
      }
    }
  }
`)

/**
 * A recommendation rail, in the catalogue's own product shape.
 *
 * **Not `aiRecommendations`**, which is the query the pipeline actually exposes
 * — that returns `AiRecommendationItem`: an id, a name, a slug, four prices and
 * a score, and none of the gallery, tags or stock flags `ProductCardFields`
 * needs. A rail built on it would mean either a second, poorer card or one
 * hydration round trip per tile. `storefrontRecommendations` ranks on the
 * server and hydrates through the same public path the catalogue uses, so this
 * document reuses the fragment and `ProductGrid` renders it unchanged.
 *
 * The strategy is **derived from the arguments, not passed**: with a
 * `product_id` the server answers "more like this" from pgvector similarity,
 * without one it answers "what is moving in this shop" from seven days of
 * behaviour events. Both are SQL — no model call and no AI budget — which is
 * what makes this safe to put on every product page.
 *
 * Only the similar rail is topped up when the ranker comes back short (same
 * taxonomy category, then newest). Trending returns empty rather than degrade
 * into a second copy of the newest row, so its caller must hide the section.
 */
export const STOREFRONT_RECOMMENDATIONS = gql(`
  query StorefrontRecommendations($product_id: String, $limit: Int) {
    storefrontRecommendations(product_id: $product_id, limit: $limit) {
      success
      data {
        ...ProductCardFields
      }
    }
  }
`)

/**
 * Public reviews for a product. `ReviewsResolver` runs this behind
 * `OptionalJwtGuard`, so it works for a signed-out visitor.
 *
 * `meta.average_rating` is the mean over *every* matching review, not the page
 * — which is what lets the rating beside the product title stay put while the
 * shopper pages through the list under it.
 */
export const PRODUCT_REVIEWS = gql(`
  query StorefrontProductReviews($product_id: String!, $page: Int, $limit: Int) {
    reviews(product_id: $product_id, page: $page, limit: $limit) {
      success
      data {
        id
        rating
        comment
        photos
        created_at
        positive_feedbacks_count
      }
      meta {
        page
        limit
        total
        total_pages
        average_rating
      }
    }
  }
`)

/**
 * Increments the product's view counter.
 *
 * Fire-and-forget from the PDP: its result is never rendered and a failure is
 * swallowed. A view count is not worth an error state on a product page.
 */
export const VIEW_PRODUCT = gql(`
  mutation StorefrontViewProduct($slug: String!) {
    viewProduct(slug: $slug) {
      success
    }
  }
`)

/**
 * Tag + collection facets for the filter panel.
 *
 * Both are `OptionalJwtGuard + RequireShopGuard`, so they return this shop's
 * own taxonomy — a filter panel built from them can never offer a tag that
 * matches nothing in the store.
 */
export const CATALOG_FACETS = gql(`
  query StorefrontCatalogFacets {
    tags(page: 1, limit: 50) {
      success
      data { id name slug products_count }
    }
    collections(page: 1, limit: 50) {
      success
      data { id name slug product_count }
    }
  }
`)

/**
 * The subset of a product `generateMetadata` needs.
 *
 * A separate, deliberately small document rather than a reuse of
 * `STOREFRONT_PRODUCT`: metadata runs before the page renders and decides four
 * strings and one image, and asking for variations, attributes, tags and the
 * whole gallery to build a share card would be paying for the page twice on a
 * request that has not started rendering yet.
 *
 * `name`, `description`, `seo_title` and `seo_description` are all multilang
 * JSON — see `shared/lib/multilang.ts`. `image` is the JSON upload blob.
 */
export const STOREFRONT_PRODUCT_META = gql(`
  query StorefrontProductMeta($slug: String!) {
    storefrontProduct(slug: $slug) {
      success
      data {
        id
        slug
        name
        description
        image
        gallery
        seo_title
        seo_description
        price_cents
        selling_price_cents
        in_stock
        sku
        brand
      }
    }
  }
`)
