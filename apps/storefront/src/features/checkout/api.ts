import { gql } from "@/shared/api/generated"

/**
 * Checkout operations.
 *
 * The split between the two is deliberate and worth understanding before
 * editing either:
 *
 *  - `verifyCheckout` **prices** the order. It is a mutation by GraphQL type
 *    only — it writes nothing. It runs behind `OptionalJwtGuard`, takes the
 *    address, and returns the shipping fee, the tax, the discount and the list
 *    of lines that cannot be fulfilled. Every number on the checkout summary
 *    comes from here, so the total the customer agrees to is one the server
 *    computed.
 *  - `createOrder` **commits** it, and is `JwtAuthGuard` — guest checkout is
 *    refused by the back-end on purpose (see the comment on `OrdersResolver`),
 *    which is why `/[shopSlug]/checkout` is behind the route guard.
 *
 * The client never adds a shipping fee to a subtotal itself. It re-verifies
 * whenever the address or the coupon changes and renders whatever comes back.
 */

export const VERIFY_CHECKOUT = gql(`
  mutation StorefrontVerifyCheckout($input: VerifyCheckoutInput!) {
    verifyCheckout(input: $input) {
      success
      data {
        subtotal_cents
        shipping_fee_cents
        tax_cents
        discount_cents
        total_cents
        coupon_applied
        shipping_available
        shipping_unavailable_reason
        # Why no carrier prices appear when the shop offers them. Three
        # situations produce the same blank list and need different words:
        # the merchant can fix one, nobody can fix another, and the third
        # fixes itself.
        carrier_unavailable_reason
        shipping_options {
          id
          name
          type
          fee_cents
          min_delivery_days
          max_delivery_days
          # The two channels are different SERVICES, not two labels for one —
          # the shop's own delivery at the shop's rate, or a shipping company
          # at that company's live price. The picker groups on this.
          channel
          carrier_name
          carrier_logo
          # Above 1 the fee is the SUM of that many parcels. A customer told
          # one price who receives two boxes was not told the truth about
          # their order, so the picker says it.
          package_count
        }
        selected_shipping_rule_id
        unavailable_products {
          product_id
          reason
          message
          available_quantity
        }
        fulfillment {
          requires_split
        }
      }
    }
  }
`)

export const CREATE_ORDER = gql(`
  mutation StorefrontCreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      success
      message
      data {
        id
        tracking_number
        order_status
        financial_status
        currency
        created_at
        payment {
          gateway
          status
        }
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
        }
      }
    }
  }
`)

/**
 * Hands an already-created order to the payment provider and returns the URL to
 * send the customer to.
 *
 * Called only for a card order, *after* `createOrder` — so a payment that never
 * completes leaves a real pending order the shop can chase, rather than a
 * charge with nothing behind it.
 */
/**
 * The pay page of an order placed in a WhatsApp chat (`/[shopSlug]/pay/[token]`).
 *
 * **No session needed, and none used**: the token from the chat is the whole
 * permission, and it opens the payment for that one order. The answer is a
 * state — `PAYABLE` with the provider's URL, `PROCESSING`, `PAID`, `CLOSED` —
 * and the order as far as a pay page shows it. Calling it again reuses the
 * open payment session rather than starting another.
 */
export const OPEN_ORDER_PAYMENT = gql(`
  mutation StorefrontOpenOrderPayment($token: String!) {
    openOrderPayment(token: $token) {
      success
      data {
        state
        closed_reason
        payment_url
        order_id
        tracking_number
        total_cents
        currency
      }
    }
  }
`)

export const CREATE_PAYMENT_LINK = gql(`
  mutation StorefrontCreatePaymentLink(
    $order_id: String!
    $payment_gateway: String!
  ) {
    createPaymentLink(order_id: $order_id, payment_gateway: $payment_gateway) {
      success
      message
      payment_url
    }
  }
`)
