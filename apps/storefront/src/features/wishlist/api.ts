import { gql } from "@/shared/api/generated"

/**
 * Saved-items operations.
 *
 * All three are `JwtAuthGuard` — unlike the cart there is no anonymous mode,
 * because a wishlist is keyed on the user row and nothing else. That is the
 * whole reason the heart on a product card degrades to "sign in to save"
 * rather than staging locally: a locally-staged wishlist would be lost the
 * moment the visitor did sign in, which is worse than never offering it.
 *
 * `wishlists` is **not** shop-scoped — a customer's saved items span every shop
 * they have shopped. The saved-items page filters to the current shop's items
 * so the page stays about the store the visitor is standing in.
 */

export const WISHLISTS = gql(`
  query StorefrontWishlists($page: Int!, $limit: Int!) {
    wishlists(page: $page, limit: $limit) {
      success
      data {
        id
        product_id
        variation_option_id
        created_at
        product {
          id
          name
          slug
          image
          price_cents
          sale_price_cents
          shop_id
        }
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

export const TOGGLE_WISHLIST = gql(`
  mutation StorefrontToggleWishlist($input: WishlistInput!) {
    toggleWishlist(input: $input) {
      success
      message
      data {
        in_wishlist
      }
    }
  }
`)

export const IN_WISHLIST = gql(`
  query StorefrontInWishlist($product_id: String!) {
    inWishlist(product_id: $product_id) {
      success
      in_wishlist
    }
  }
`)
