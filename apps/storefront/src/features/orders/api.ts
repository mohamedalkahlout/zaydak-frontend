import { gql } from "@/shared/api/generated"

/**
 * Order-history operations.
 *
 * `orders` and `order` are `JwtAuthGuard`, and every caller here is a **buyer**
 * — `createOrder` carries no permission check, so a vendor shopping in another
 * shop's storefront is an ordinary customer. The back-end cannot infer that
 * from the role (the same account is a seller in its own dashboard), so the
 * list asks for it explicitly with `as_customer: true`; `order` resolves either
 * way for a single row. Neither passes a `customer_id` filter — the scope is
 * the caller's identity off the token, and sending an id would be both
 * redundant and the kind of argument that invites someone to try another one.
 */

export const ORDER_SUMMARY_FRAGMENT = gql(`
  fragment OrderSummaryFields on OrderEntry {
    id
    tracking_number
    order_status
    financial_status
    fulfillment_status
    currency
    created_at
    pricing {
      subtotal_cents
      discount_cents
      tax_cents
      delivery_fee_cents
      total_cents
      paid_total_cents
    }
    shop {
      id
      name
      slug
      logo
    }
    products {
      id
      product_id
      name
      slug
      image
      order_quantity
      unit_price_cents
      subtotal_cents
      variation_title
    }
  }
`)

export const MY_ORDERS = gql(`
  query StorefrontMyOrders($filters: FilterOrdersInput) {
    orders(filters: $filters) {
      success
      data {
        ...OrderSummaryFields
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

/**
 * Everything the order screen reads — shared by `order(id)` (a signed-in
 * customer) and `payLinkOrder(token)` (the page a chat's pay link returns to
 * once paid), so the two can never show different orders' worth of fields.
 */
export const ORDER_DETAIL_FRAGMENT = gql(`
  fragment StorefrontOrderDetailFields on OrderEntry {
    ...OrderSummaryFields
    note
    language
    updated_at
    payment {
      gateway
      altered_gateway
      status
    }
    delivery {
      fee_cents
      time
    }
    shipping_method
    payment_expires_at
    payment_instructions { ...StorefrontBankAccountSnapshot }
    invoices {
      id
      invoice_number
      status
      due_date
      paid_at
    }
    shipments {
      id
      status
      carrier_name
      tracking_number
      tracking_url
      shipped_at
      delivered_at
      created_at
    }
    addresses {
      shipping
      billing
    }
    customer {
      id
      name
      email
      phone
    }
    coupons {
      coupon_id
      code
      applied_discount_cents
    }
  }
`)

export const ORDER_DETAIL = gql(`
  query StorefrontOrder($id: String!) {
    order(id: $id) {
      success
      data {
        ...StorefrontOrderDetailFields
      }
    }
  }
`)

/**
 * The order behind a chat's pay link, read with the link's token instead of
 * a session: a customer paying from a chat has usually never signed in on
 * this browser.
 */
export const PAY_LINK_ORDER = gql(`
  query StorefrontPayLinkOrder($token: String!) {
    payLinkOrder(token: $token) {
      success
      data {
        ...StorefrontOrderDetailFields
      }
    }
  }
`)

export const CANCEL_ORDER = gql(`
  mutation StorefrontCancelOrder($id: String!) {
    cancelOrder(id: $id) {
      success
      message
      data {
        id
        order_status
        financial_status
      }
    }
  }
`)
