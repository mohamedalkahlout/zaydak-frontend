import { gql } from "@apollo/client"

const ORDER_MUTATION_FIELDS = gql`
  fragment OrderMutationFields on OrderEntry {
    id
    tracking_number
    order_status
    payment {
      status
      gateway
      altered_gateway
    }
    pricing {
      subtotal_cents
      tax_cents
      discount_cents
      delivery_fee_cents
      total_cents
      paid_total_cents
    }
    customer {
      id
      name
      email
      phone
      contact
    }
    created_at
    updated_at
  }
`

export const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      success
      message
      data {
        ...OrderMutationFields
      }
    }
  }
  ${ORDER_MUTATION_FIELDS}
`

export const UPDATE_ORDER = gql`
  mutation UpdateOrder($input: UpdateOrderInput!) {
    updateOrder(input: $input) {
      success
      message
      data {
        ...OrderMutationFields
      }
    }
  }
  ${ORDER_MUTATION_FIELDS}
`

export const EDIT_ORDER = gql`
  mutation EditOrder($input: EditOrderInput!) {
    editOrder(input: $input) {
      success
      message
      data {
        ...OrderMutationFields
        note
        fulfillment_status
        financial_status
        products {
          id
          product_id
          name
          slug
          image
          order_quantity
          fulfilled_quantity
          unit_price_cents
          subtotal_cents
          variation_option_id
          variation_title
          variation_options
        }
      }
    }
  }
  ${ORDER_MUTATION_FIELDS}
`

export const DELETE_ORDER = gql`
  mutation DeleteOrder($id: String!) {
    deleteOrder(id: $id) {
      success
      message
    }
  }
`

/**
 * Ships part or all of an order. Omitting `lines` fulfils every remaining
 * quantity. The back-end moves the committed stock out (committed down, on_hand
 * down) and recomputes `fulfillment_status`, so the response is selected wide
 * enough to repaint the screen without a refetch race.
 */
export const FULFILL_ORDER = gql`
  mutation FulfillOrder($input: FulfillOrderInput!) {
    fulfillOrder(input: $input) {
      success
      message
      data {
        id
        order_status
        fulfillment_status
        products {
          id
          order_quantity
          fulfilled_quantity
        }
        fulfillments {
          id
          status
          tracking_number
          tracking_company
          tracking_url
          shipped_at
          created_at
          line_items {
            order_product_id
            quantity
          }
        }
      }
    }
  }
`

/**
 * Creates a refund in `pending` status. No money moves here — approval does
 * that (see UPDATE_REFUND_STATUS), which is why the two are separate calls
 * rather than one button.
 */
export const CREATE_REFUND = gql`
  mutation CreateRefund($input: CreateRefundInput!) {
    createRefund(input: $input) {
      success
      message
      data {
        id
        order_id
        amount_cents
        refund_quantity
        is_partial
        status
        title
        description
        created_at
        updated_at
      }
    }
  }
`

/**
 * Approving MOVES MONEY: it debits the vendor balance, restocks the lines
 * flagged `restock`, rewinds coupon usage, and — for a Stripe-paid order —
 * issues the real gateway refund. Every caller must confirm first.
 */
export const UPDATE_REFUND_STATUS = gql`
  mutation UpdateRefundStatus($input: UpdateRefundStatusInput!) {
    updateRefundStatus(input: $input) {
      success
      message
      data {
        id
        status
        amount_cents
        updated_at
      }
    }
  }
`

/**
 * MOVES MONEY: refunds, in full, a card payment the order never took, to the
 * card it came from. Nothing else changes — not the order's status, totals or
 * items, not the shop's balance. Idempotent on the server (a double click, a
 * retry or a second staff member never refunds twice), and still confirmed
 * first. Also "Check again" for a refund the provider has not settled yet.
 * A refusal is an answer (`success: false` with `data.refund_status`), not
 * an error.
 */
export const REFUND_UNAPPLIED_PAYMENT = gql`
  mutation RefundUnappliedPayment($payment_intent_id: String!) {
    refundUnappliedPayment(payment_intent_id: $payment_intent_id) {
      success
      message
      data {
        id
        reason
        amount_cents
        currency
        paid_at
        refund_status
        refunded_at
        refund_error
      }
    }
  }
`

/**
 * The orders list as one CSV body, under the list's own filters and sort (the
 * API builds both from the same `where`). A mutation, like the products
 * export it follows: it is called on demand and its result, up to 10,000
 * orders, has no business in the Apollo cache.
 */
export const EXPORT_ORDERS_CSV = gql`
  mutation ExportOrdersCsv($filters: FilterOrdersInput) {
    exportOrdersCsv(filters: $filters) {
      success
      csv
      rows
      truncated
    }
  }
`
