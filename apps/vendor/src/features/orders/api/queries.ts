import { gql } from "@apollo/client"

const ORDER_CORE_FIELDS = gql`
  fragment OrderCoreFields on OrderEntry {
    id
    tracking_number
    order_status
    note
    language
    placed_via
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
    delivery {
      fee_cents
      time
    }
    shipping_method
    customer {
      id
      name
      email
      phone
      contact
    }
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
    coupons {
      coupon_id
      code
      applied_discount_cents
    }
    addresses {
      shipping
      billing
    }
    shop {
      id
      name
      slug
      logo
    }
    created_at
    updated_at
  }
`

const ORDER_DETAIL_FIELDS = gql`
  fragment OrderDetailFields on OrderEntry {
    ...OrderCoreFields
    payment_instructions {
      id bank_code bank_name account_holder_name account_number iban swift_code currency notes
    }
    payment_expires_at
    # Orthogonal to order_status: an order can be paid and unfulfilled, or
    # shipped and refunded. The fulfil / refund actions key off these, not off
    # the legacy combined lifecycle.
    fulfillment_status
    financial_status
    fulfillments {
      id
      status
      tracking_number
      tracking_company
      tracking_url
      location_id
      location_name
      shipped_at
      created_at
      line_items {
        order_product_id
        quantity
      }
    }
    refunds {
      id
      order_id
      product_id
      amount_cents
      refund_quantity
      is_partial
      status
      title
      description
      images
      created_at
      updated_at
    }
    invoices {
      id
      invoice_number
      invoice_url
      issued_at
      # Set only on an INVOICE order: when its payment falls due.
      due_date
      status
      currency
      total_amount_cents
    }
    cancellation {
      amount_cents
      tax_cents
      delivery_fee_cents
    }
    wallet_point {
      id
      amount_cents
    }
  }
  ${ORDER_CORE_FIELDS}
`

export const GET_ORDERS = gql`
  query Orders($filters: FilterOrdersInput) {
    orders(filters: $filters) {
      success
      data {
        ...OrderCoreFields
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
  ${ORDER_CORE_FIELDS}
`

export const GET_ORDER_BY_ID = gql`
  query Order($id: String!) {
    order(id: $id) {
      success
      message
      data {
        ...OrderDetailFields
      }
    }
  }
  ${ORDER_DETAIL_FIELDS}
`

export const GET_ORDER_BY_TRACKING = gql`
  query OrderByTrackingNumber($tracking_number: String!) {
    orderByTrackingNumber(tracking_number: $tracking_number) {
      success
      message
      data {
        ...OrderDetailFields
      }
    }
  }
  ${ORDER_DETAIL_FIELDS}
`

/**
 * The card payments an order never took (`OrderEntry.unapplied_payments`):
 * paid after it closed, for a different amount, or a second time.
 *
 * Its own query rather than a field in `ORDER_DETAIL_FIELDS`: the card
 * refetches it alone after a refund or a "Check again", and a failure here
 * costs that one panel, never the order page. (It began separate so an API
 * image older than the dashboard cost only the panel; the API serves the
 * field now and that fallback is gone.)
 *
 * It selects the same wrapper fields as `GET_ORDER_BY_ID` (`success`,
 * `message`), so the two writing the same `order(id)` cache entry never drop
 * each other's fields and set off a refetch.
 */
export const ORDER_UNAPPLIED_PAYMENTS = gql`
  query OrderUnappliedPayments($id: String!) {
    order(id: $id) {
      success
      message
      data {
        id
        unapplied_payments {
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
  }
`
