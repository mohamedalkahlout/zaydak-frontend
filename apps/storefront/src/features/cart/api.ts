import { gql } from "@/shared/api/generated"

/**
 * Cart operations.
 *
 * Every one takes an optional `session_id`. That argument is what makes an
 * anonymous cart possible: `CartResolver` runs behind `OptionalJwtGuard`, so
 * when there is no token the back-end keys the cart on the id this app minted
 * (see `shared/lib/cart-session.ts`) instead of on a user. Dropping the
 * argument would not fail — it would silently give every signed-out visitor a
 * fresh empty cart on every page.
 *
 * They all return the whole `CartEnvelope` rather than a delta, so one mutation
 * result repaints the header badge, the cart page and the checkout summary from
 * the same server-computed totals. Re-deriving a subtotal on the client is how
 * the number in the header stops matching the number on the invoice.
 */

export const CART_FRAGMENT = gql(`
  fragment CartFields on CartEnvelope {
    id
    shop {
      id
      name
      slug
      logo
    }
    items {
      id
      product_id
      variation_option_id
      name
      variation_name
      slug
      image
      quantity
      unit_price_cents
      price_cents
      sale_price_cents
      discount_cents
      total_price_cents
      is_variation
      requires_shipping
      is_digital
      product_type
      status
      stock_status
      unavailable_reason
      custom_options
      composition
      is_ai_negotiated
      negotiated_offer_id
      negotiated_expires_at
    }
    summary {
      currency
      total_items
      subtotal_price_cents
      discount_cents
      tax_bps
      total_tax_amount_cents
      total_price_cents
      coupons {
        id
        code
        discount_cents
      }
    }
  }
`)

export const CART = gql(`
  query StorefrontCart($session_id: String) {
    cart(session_id: $session_id) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

export const ADD_TO_CART = gql(`
  mutation StorefrontAddToCart($input: AddToCartInput!, $session_id: String) {
    addToCart(input: $input, session_id: $session_id) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

export const UPDATE_CART_ITEM = gql(`
  mutation StorefrontUpdateCartItem(
    $input: UpdateCartItemInput!
    $session_id: String
  ) {
    updateCartItem(input: $input, session_id: $session_id) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

export const REMOVE_CART_ITEM = gql(`
  mutation StorefrontRemoveCartItem($item_id: String!, $session_id: String) {
    removeCartItem(item_id: $item_id, session_id: $session_id) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

export const CLEAR_CART = gql(`
  mutation StorefrontClearCart($session_id: String) {
    clearCart(session_id: $session_id) {
      success
      message
    }
  }
`)

export const APPLY_CART_COUPON = gql(`
  mutation StorefrontApplyCartCoupon($code: String!, $session_id: String) {
    applyCartCoupon(code: $code, session_id: $session_id) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

export const REMOVE_CART_COUPON = gql(`
  mutation StorefrontRemoveCartCoupon(
    $coupon_id: String!
    $session_id: String
  ) {
    removeCartCoupon(coupon_id: $coupon_id, session_id: $session_id) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

/**
 * Move the signed-out cart onto the account that just signed in.
 *
 * The one cart operation behind `JwtAuthGuard` rather than `OptionalJwtGuard`,
 * because it is the only one whose whole purpose is having a user to move the
 * cart *to*. `session_id` names the guest cart to take over; the back-end
 * releases its stock holds, soft-deletes it, and re-reserves under the user's.
 *
 * **Destructive on the user's side by design** — `CartSyncService` wipes what
 * the account was holding and replaces it with these items, which is why
 * `adoptGuestCart` refuses to send an empty list. See that module.
 */
export const SYNC_CART = gql(`
  mutation StorefrontSyncCart($input: SyncCartInput!) {
    syncCart(input: $input) {
      success
      message
      data {
        ...CartFields
      }
    }
  }
`)

/**
 * Report that the shopper arrived from a recovery reminder's cart link.
 *
 * The reminder's `cart_url` carries a signed `?rc=` token (HMAC over cart and
 * shop, minted by the back-end); this sends it back so the merchant's
 * abandoned-carts list can show the cart as returned. Public on purpose — a
 * shopper who clicks through signed out still clicked, and the token is the
 * whole authorization. Fired once by `useReminderLinkOpen` on the cart page.
 */
export const RECORD_CART_LINK_OPEN = gql(`
  mutation StorefrontRecordCartLinkOpen($token: String!) {
    recordCartLinkOpen(token: $token) {
      success
      recorded
    }
  }
`)
