import type { Order } from "@/features/orders/types"
import { hasValidationCode } from "@/shared/lib/validation-errors"

/**
 * The rules around the order screen's "Mark as cancelled". The server holds
 * the same ones under the order lock (`updateOrder` -> `cancelOrderAtomically`
 * with `refuseAppliedCardPayment`); these only decide what the merchant is
 * told before and after.
 */

/**
 * A card (STRIPE) order whose payment the order took. Cancelling it would not
 * return the money — nothing in a cancellation refunds the card, and a goods
 * refund refuses a cancelled order — so the server refuses the cancel
 * (`REFUND_CARD_PAYMENT_FIRST`) and the merchant refunds the order instead.
 * The server also reads the order's payment records, so a paid card order
 * whose status was written over by hand is refused there even when this
 * says false.
 */
export function isPaidCardOrder(order: Pick<Order, "payment">): boolean {
  return (
    order.payment.gateway?.toUpperCase() === "STRIPE" &&
    order.payment.status === "payment-success"
  )
}

/**
 * The `orders.statusActions.cancel` key for a refused cancel. The server's
 * `REFUND_CARD_PAYMENT_FIRST` gets its own sentence; anything else reads as
 * the generic failure, with the server's message beneath it.
 */
export function cancelRefusalKey(err: unknown): "cardPaid" | "failed" {
  return hasValidationCode(err, "REFUND_CARD_PAYMENT_FIRST")
    ? "cardPaid"
    : "failed"
}
