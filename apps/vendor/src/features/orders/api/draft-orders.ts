import { gql } from "@apollo/client"

/**
 * Draft orders — merchant-built orders that stage line items, a customer, a
 * note and a manual discount before being converted into a real Order (which
 * prices, taxes, and reserves stock authoritatively). Money is in integer
 * cents throughout; `subtotal_cents` / `estimated_total_cents` are an estimate
 * that excludes tax + shipping.
 */
const DRAFT_ORDER_FIELDS = gql`
  fragment DraftOrderFields on DraftOrderEntry {
    id
    shop_id
    customer_id
    customer_name
    customer_contact
    customer_email
    status
    note
    manual_discount_cents
    shipping_override_cents
    shipping_rule_id
    shipping_method_name
    currency
    shipping_address
    billing_address
    tags
    payment_due_later
    payment_terms
    coupon_ids
    coupons {
      id
      code
      description
      available
      requires_customer
    }
    order_id
    line_items {
      id
      product_id
      variation_option_id
      product_name
      slug
      image
      variant_title
      quantity
      unit_price_cents
      subtotal_cents
    }
    subtotal_cents
    estimated_total_cents
    created_at
    updated_at
  }
`

export const GET_DRAFT_ORDERS = gql`
  query DraftOrders($page: Int, $limit: Int) {
    draftOrders(page: $page, limit: $limit) {
      success
      data {
        ...DraftOrderFields
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
  ${DRAFT_ORDER_FIELDS}
`

export const GET_DRAFT_ORDER = gql`
  query DraftOrder($id: String!) {
    draftOrder(id: $id) {
      success
      message
      data {
        ...DraftOrderFields
      }
    }
  }
  ${DRAFT_ORDER_FIELDS}
`

export const CREATE_DRAFT_ORDER = gql`
  mutation CreateDraftOrder($input: CreateDraftOrderInput!) {
    createDraftOrder(input: $input) {
      success
      message
      data {
        ...DraftOrderFields
      }
    }
  }
  ${DRAFT_ORDER_FIELDS}
`

export const UPDATE_DRAFT_ORDER = gql`
  mutation UpdateDraftOrder($input: UpdateDraftOrderInput!) {
    updateDraftOrder(input: $input) {
      success
      message
      data {
        ...DraftOrderFields
      }
    }
  }
  ${DRAFT_ORDER_FIELDS}
`

export const CONVERT_DRAFT_ORDER = gql`
  mutation ConvertDraftOrder($input: ConvertDraftOrderInput!) {
    convertDraftOrder(input: $input) {
      success
      message
      data {
        ...DraftOrderFields
      }
    }
  }
  ${DRAFT_ORDER_FIELDS}
`

/**
 * The shop's active coupons, for the draft's "Add discount" picker. Only what
 * the picker shows: the draft saves ids (`coupon_ids`) and the server prices
 * them when the draft converts.
 */
export const DRAFT_COUPON_OPTIONS = gql`
  query DraftCouponOptions($limit: Int, $search: String) {
    coupons(page: 1, limit: $limit, statuses: [ACTIVE], search: $search) {
      success
      data {
        id
        code
        description
        type
        value_type
        amount_cents
        percent_bps
        method
        eligibility
        max_uses_per_user
      }
    }
  }
`

export const DELETE_DRAFT_ORDER = gql`
  mutation DeleteDraftOrder($id: String!) {
    deleteDraftOrder(id: $id) {
      success
      message
    }
  }
`

export const SEND_DRAFT_INVOICE = gql`
  mutation SendDraftInvoice($input: SendDraftInvoiceInput!) {
    sendDraftInvoice(input: $input) {
      success
      message
    }
  }
`

/**
 * Price shipping for a draft the same way checkout does.
 *
 * Draft conversion only persists `shipping_override_cents` (name+fee), so the
 * picker uses this quote to *offer* shop methods and then stores the chosen
 * fee as a merchant override. It writes nothing — mutation by GraphQL type
 * only. Catalog lines only: custom (product-less) lines cannot be quoted.
 */
export const VERIFY_DRAFT_SHIPPING = gql`
  mutation VerifyDraftShipping($input: VerifyCheckoutInput!) {
    verifyCheckout(input: $input) {
      success
      data {
        shipping_available
        shipping_unavailable_reason
        carrier_unavailable_reason
        shipping_options {
          id
          name
          type
          fee_cents
          min_delivery_days
          max_delivery_days
          channel
          carrier_name
          carrier_logo
          package_count
        }
      }
    }
  }
`
