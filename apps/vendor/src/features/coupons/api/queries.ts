import { gql } from "@apollo/client"

/**
 * The shop's customers, for the coupon customer picker. A coupon for named
 * customers names this shop's customers (`customers.id`) — the server refuses
 * anybody else — and the search runs server-side: by name or email as typed,
 * and by the digits of a number.
 */
export const GET_SHOP_CUSTOMERS_FOR_COUPON = gql`
  query ShopCustomersForCoupon($search: String, $page: Int, $limit: Int) {
    shopCustomers(search: $search, page: $page, limit: $limit) {
      success
      data {
        id
        name
        phone_e164
        email
      }
    }
  }
`

export const GET_COUPON_BY_ID = gql`
  query Coupon($id: String!) {
    coupon(id: $id) {
      success
      message
      data {
        id
        code
        description
        type
        value_type
        amount_cents
        percent_bps
        max_discount_cents
        minimum_cart_amount_cents
        minimum_quantity
        max_uses
        max_uses_per_user
        max_uses_per_order
        method
        eligibility
        customer_ids
        segment_ids
        product_ids
        collection_ids
        buy_product_ids
        buy_collection_ids
        get_product_ids
        get_collection_ids
        countries
        exclude_shipping_rates_over_cents
        active_from
        expire_at
        buy_quantity
        get_quantity
        get_discount_type
        get_discount_amount_cents
        get_discount_percent_bps
        combinations {
          allow_product
          allow_order
          allow_shipping
        }
        is_exclusive
        priority
        currency
        class
        target
        language
        timezone
        image
        is_valid
        is_valid_for_me
        times_used
        created_at
        updated_at
        products {
          id
          name
          slug
          image
        }
        customers {
          id
          name
          email
        }
        segments {
          id
          name
        }
      }
    }
  }
`

export const GET_COUPONS = gql`
  query Coupons(
    $page: Int
    $limit: Int
    $search: String
    $statuses: [CouponStatusFilter!]
    $types: [CouponType!]
    $scopes: [CouponScopeFilter!]
  ) {
    coupons(
      page: $page
      limit: $limit
      search: $search
      statuses: $statuses
      types: $types
      scopes: $scopes
    ) {
      success
      data {
        id
        code
        description
        type
        value_type
        amount_cents
        percent_bps
        minimum_cart_amount_cents
        minimum_quantity
        max_discount_cents
        buy_quantity
        get_quantity
        get_discount_type
        get_discount_amount_cents
        get_discount_percent_bps
        max_uses_per_order
        active_from
        expire_at
        max_uses
        max_uses_per_user
        target
        language
        timezone
        method
        eligibility
        product_ids
        collection_ids
        buy_product_ids
        buy_collection_ids
        get_product_ids
        get_collection_ids
        customer_ids
        segment_ids
        countries
        exclude_shipping_rates_over_cents
        is_exclusive
        combinations {
          allow_product
          allow_order
          allow_shipping
        }
        priority
        currency
        class
        is_valid
        is_valid_for_me
        times_used
        image
        created_at
        updated_at
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

export const GET_COUPON_PERFORMANCE = gql`
  query CouponPerformance($id: String!) {
    couponPerformance(id: $id) {
      success
      data {
        coupon_id
        times_used
        total_discount_given_cents
        total_revenue_attributed_cents
        avg_order_value_cents
        first_used_at
        last_used_at
      }
    }
  }
`
