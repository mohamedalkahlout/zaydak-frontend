import { gql } from "@apollo/client"

export const CREATE_COUPON = gql`
  mutation CreateCoupon($input: CreateCouponInput!) {
    createCoupon(input: $input) {
      success
      data {
        id
        code
        type
        value_type
        amount_cents
        percent_bps
        priority
        class
        is_valid
      }
    }
  }
`

export const UPDATE_COUPON = gql`
  mutation UpdateCoupon($input: UpdateCouponInput!) {
    updateCoupon(input: $input) {
      success
      message
      data {
        id
        code
        type
        value_type
        amount_cents
        percent_bps
        priority
        class
        is_valid
      }
    }
  }
`

export const DELETE_COUPON = gql`
  mutation DeleteCoupon($id: String!) {
    deleteCoupon(id: $id) {
      success
      message
    }
  }
`

export const VERIFY_COUPON = gql`
  mutation VerifyCoupon($input: VerifyCouponInput!) {
    verifyCoupon(input: $input) {
      is_valid
      message
      reason_code
      coupon {
        id
        code
        type
        value_type
        amount_cents
        percent_bps
        max_discount_cents
        class
        is_valid
      }
      discount_preview {
        total_cents
        product_cents
        order_cents
        shipping_cents
        cart_hash
      }
      conflicts_with {
        coupon_id
        code
        class
        reason
        message
      }
    }
  }
`
