import { gql } from "@apollo/client"

/** Published products in one collection, for the doughn preview slots. */
export const THEME_COLLECTION_PRODUCTS = gql`
  query ThemeCollectionProducts($filters: ProductFilterInput) {
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

/**
 * The one shop fact the theme library and the editor preview need.
 *
 * A dedicated document rather than a field on `MyShops`: those screens are
 * not the settings panes, and they should not drag the brand payload along.
 */
export const SHOP_STOREFRONT_TEMPLATE = gql`
  query ShopStorefrontTemplate($slug: String!) {
    shop(slug: $slug) {
      data {
        id
        storefront_template
        storefront_theme
      }
    }
  }
`
