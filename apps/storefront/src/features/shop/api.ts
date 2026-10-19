import { gql } from "@/shared/api/generated"

/**
 * Shop identity operations.
 *
 * `shop(slug)` runs behind `OptionalJwtGuard` only, and `ShopsService.findBySlug`
 * refuses any shop that is not both `is_approved` and `is_active` — so a 404
 * here is the correct storefront answer for a suspended or unapproved store,
 * not an error to work around.
 */

export const SHOP_BY_SLUG = gql(`
  query StorefrontShop($slug: String!) {
    shop(slug: $slug) {
      success
      data {
        id
        name
        slug
        currency
        home_country
        created_at
        description
        logo { id original thumbnail }
        cover_image { id original thumbnail }
        address
        socials { id name link }
        settings {
          contact
          email
          website
          isShopUnderMaintenance
          location { city state country formattedAddress }
          policies {
            refund_policy
            privacy_policy
            terms_of_service
            shipping_policy
          }
        }
        products_count
      }
    }
  }
`)

/**
 * The shop directory behind `/`.
 *
 * `is_approved: true` is passed explicitly even though the service also hides
 * unapproved shops from an anonymous caller — an admin browsing the storefront
 * carries a token that would otherwise widen the list to shops no customer can
 * open.
 */
export const PUBLIC_SHOPS = gql(`
  query StorefrontShops($page: Int!, $limit: Int!, $search: String) {
    shops(page: $page, limit: $limit, search: $search, is_approved: true) {
      success
      data {
        id
        name
        slug
        description
        logo { id original thumbnail }
        cover_image { id original thumbnail }
        products_count
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

/**
 * The homepage's merchandising facets.
 *
 * `collections` and `tags` are both `OptionalJwtGuard + ShopHeaderGuard +
 * RequireShopGuard` (see `back-end/src/collections/collections.resolver.ts:34`
 * and `back-end/src/tags/tags.resolver.ts:30`), so a signed-out visitor can
 * read them — which is what lets the front page be merchandised rather than
 * being one flat list of products.
 *
 * It is deliberately **not** `CATALOG_FACETS`: that document is the filter
 * panel's, and asks for 50 of each because a filter list wants to be complete.
 * A front page wants the first handful and needs `image` and `sort_order`,
 * which the panel never selects. Sharing one document would mean every filter
 * open re-fetched the homepage's images, and every homepage visit paid for 100
 * facet rows it does not draw.
 */
export const HOME_FACETS = gql(`
  query StorefrontHomeFacets {
    collections(page: 1, limit: 8) {
      success
      data {
        id
        name
        slug
        description
        image
      }
      meta { total }
    }
    tags(page: 1, limit: 12) {
      success
      data {
        id
        name
        slug
        icon
        products_count
      }
      meta { total }
    }
  }
`)

/**
 * The two product queries the front page runs, as exported variables.
 *
 * They live beside the documents rather than inside `ShopHome` because the page
 * preloads them on the server and the component reads them back on the client,
 * and `useSuspenseQuery` matches a preload **by query plus variables**. A limit
 * that drifted between the two places would not error — it would silently open
 * a second request for almost the same rows, which is the exact cost preloading
 * exists to remove. One definition, imported twice.
 *
 * `MOST_VIEWED` and `NEWEST` are genuinely different questions and need their
 * own round trips. The markdown rail does not: the API has no "on sale"
 * predicate at all, so it is selected on the client out of the recent sample —
 * which is why that sample is wider than the grid that draws from it.
 */
export const HOME_POPULAR_VARIABLES = {
  filters: { page: 1, limit: 10, sort_by: "MOST_VIEWED" as const },
}

export const HOME_RECENT_VARIABLES = {
  filters: { page: 1, limit: 24, sort_by: "NEWEST" as const },
}

/**
 * The trending rail — what shoppers actually engaged with in the last week.
 *
 * **Not the same question as `MOST_VIEWED`**, which is a lifetime counter on
 * the product row: a product that sold well a year ago outranks one everybody
 * is looking at today, forever. This reads seven days of behaviour events, so
 * it moves. Both rails earn their place because "the shop's best sellers" and
 * "what is moving right now" are different answers.
 *
 * `product_id` is deliberately absent — that is what selects the trending
 * strategy over per-product similarity. No `filters` key either: the server
 * derives everything, so there is nothing here for the two call sites to drift
 * on beyond the limit.
 *
 * **This rail can legitimately come back empty**, and the home page removes the
 * section when it does. A shop with no traffic in the window has nothing
 * trending, and the server deliberately does not top it up from the newest
 * products the way the per-product rail is topped up — that would put a second
 * copy of the "new arrivals" row on the page under a heading claiming it was
 * something else.
 */
export const HOME_TRENDING_VARIABLES = {
  limit: 10,
}

/** How many storefronts the directory asks for. */
export const DIRECTORY_PAGE_SIZE = 24

/**
 * The directory's variables, built the same way on the server and the client.
 *
 * The landing page preloads the unsearched first page and `ShopDirectory` reads
 * it back, and `useSuspenseQuery` pairs the two by query *and variables* — so
 * the empty-search case has to produce a byte-identical object on both sides.
 * Spreading `search` in only when it is non-empty is what does that: sending
 * `search: ""` would be a different variables object for the same list, and
 * would also ask the API to filter on nothing.
 */
export function directoryVariables(search: string) {
  const trimmed = search.trim()
  return {
    page: 1,
    limit: DIRECTORY_PAGE_SIZE,
    ...(trimmed ? { search: trimmed } : {}),
  }
}

/**
 * Record a shopper's email address against the current store's newsletter
 * subscription list.
 */
export const SUBSCRIBE_NEWSLETTER = gql(`
  mutation StorefrontSubscribeNewsletter($email: String!, $shop_id: String, $shop_slug: String) {
    subscribeNewsletter(email: $email, shop_id: $shop_id, shop_slug: $shop_slug) {
      success
      message
    }
  }
`)

/** Assembly rules for one product, including each part's name and photos. */
export const STOREFRONT_PRODUCT_COMPOSITION = gql(`
  query StorefrontProductComposition($product_id: String!) {
    storefrontProductComposition(product_id: $product_id) {
      success
      data {
        product_id
        min_count
        max_count
        vessel_cap
        price_ladder_cents
        groups {
          key
          priced_by_ladder
          addon_cents
          parts {
            product_id
            addon_cents
            cutout_url
            image_url
            name
          }
        }
      }
    }
  }
`)

