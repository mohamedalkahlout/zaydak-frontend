import { gql } from "@/shared/api/generated"

export const NEGOTIATION_POLICIES = gql(`
  query NegotiationPolicies($product_id: String!) {
    negotiationPolicies(product_id: $product_id) {
      success
      data {
        id
        shop_id
        product_id
        variation_option_id
        enabled
        floor_mode
        strategy
        minimum_price_cents
        max_discount_bps
        minimum_margin_bps
        preferred_price_cents
        max_rounds
        offer_ttl_seconds
        allow_coupon_stacking
        max_negotiations_per_customer_per_day
        floor_preview {
          from_minimum_price_cents
          from_max_discount_cents
          from_minimum_margin_cents
          from_dynamic_cents
          effective_floor_cents
          list_price_cents
        }
      }
    }
  }
`)

export const PREVIEW_NEGOTIATION_FLOOR = gql(`
  query PreviewNegotiationFloor($input: PreviewNegotiationFloorInput!) {
    previewNegotiationFloor(input: $input) {
      success
      data {
        from_minimum_price_cents
        from_max_discount_cents
        from_minimum_margin_cents
        from_dynamic_cents
        effective_floor_cents
        list_price_cents
      }
    }
  }
`)

export const UPSERT_NEGOTIATION_POLICY = gql(`
  mutation UpsertNegotiationPolicy($input: UpsertNegotiationPolicyInput!) {
    upsertNegotiationPolicy(input: $input) {
      success
      data {
        id
        shop_id
        product_id
        variation_option_id
        enabled
        floor_mode
        strategy
        minimum_price_cents
        max_discount_bps
        minimum_margin_bps
        preferred_price_cents
        max_rounds
        offer_ttl_seconds
        allow_coupon_stacking
        max_negotiations_per_customer_per_day
        floor_preview {
          from_minimum_price_cents
          from_max_discount_cents
          from_minimum_margin_cents
          from_dynamic_cents
          effective_floor_cents
          list_price_cents
        }
      }
    }
  }
`)

/**
 * The options of a product that do not negotiate, as the form's switches
 * stand — the whole list, so an option left out of it negotiates again.
 */
export const SET_NEGOTIATION_EXCLUDED_OPTIONS = gql(`
  mutation SetNegotiationExcludedOptions(
    $input: SetNegotiationExcludedOptionsInput!
  ) {
    setNegotiationExcludedOptions(input: $input) {
      success
      data
    }
  }
`)

/**
 * The options of a product with a minimum selling price of their own, as the
 * form's inputs stand — the whole list, so an option left out of it follows
 * the product's floor again. Sent after the product's own policy, which the
 * server copies into each option's row.
 */
export const SET_NEGOTIATION_OPTION_FLOORS = gql(`
  mutation SetNegotiationOptionFloors($input: SetNegotiationOptionFloorsInput!) {
    setNegotiationOptionFloors(input: $input) {
      success
      data {
        variation_option_id
        minimum_price_cents
      }
    }
  }
`)

export const PRODUCT_NEGOTIATION_STATUSES = gql(`
  query ProductNegotiationStatuses($product_ids: [String!]!) {
    productNegotiationStatuses(product_ids: $product_ids) {
      success
      data {
        product_id
        enabled
        enabled_variant_count
        total_variant_count
        label
      }
    }
  }
`)
