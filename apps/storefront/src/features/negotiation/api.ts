import { gql } from "@/shared/api/generated"

export const NEGOTIATION_AVAILABLE = gql(`
  query StorefrontNegotiationAvailable(
    $product_id: String!
    $variation_option_id: String
  ) {
    negotiationAvailable(
      product_id: $product_id
      variation_option_id: $variation_option_id
    ) {
      success
      available
    }
  }
`)

export const ACCEPT_NEGOTIATION = gql(`
  mutation StorefrontAcceptNegotiation(
    $input: AcceptNegotiationInput!
    $guest_key: String
  ) {
    acceptNegotiation(input: $input, guest_key: $guest_key) {
      success
      data {
        id
        product_id
        variation_option_id
        original_cents
        negotiated_cents
        quantity
        currency
        status
        expires_at
        allow_coupon_stacking
      }
    }
  }
`)

export const ADD_NEGOTIATED_OFFER_TO_CART = gql(`
  mutation StorefrontAddNegotiatedOfferToCart(
    $input: AddNegotiatedOfferToCartInput!
    $session_id: String
  ) {
    addNegotiatedOfferToCart(input: $input, session_id: $session_id) {
      success
      message
      data {
        id
        items {
          id
          product_id
          quantity
          unit_price_cents
          total_price_cents
          is_ai_negotiated
          negotiated_offer_id
          negotiated_expires_at
        }
      }
    }
  }
`)
