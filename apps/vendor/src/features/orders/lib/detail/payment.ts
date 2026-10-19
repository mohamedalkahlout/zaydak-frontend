import type { Order } from "@/features/orders/types"
import { isTerminalStatus } from "@/features/orders/lib/list/status-transitions"

/** The payment status the settle action writes: the one that reads "Paid". */
export const SETTLED_PAYMENT_STATUS = "payment-success" as const

/**
 * The one gateway the order screen settles by hand: the merchant's own
 * "payment due later", recorded when a draft converts.
 */
export const SETTLEABLE_GATEWAY = "INVOICE" as const

/**
 * Whether the order screen offers "Mark as paid".
 *
 * Only for merchant-recorded deferred payment: an INVOICE order (a "payment
 * due later" draft after conversion) whose payment is still pending, and never
 * on a cancelled, failed or refunded order. A completed order still qualifies:
 * net-30 goods are usually delivered before they are paid for.
 *
 * Deliberately not for a pending card (STRIPE) order: a Checkout session the
 * customer already opened can still complete after the merchant marks the
 * order paid, and the customer would pay twice. The server refuses that write
 * with MANUAL_PAYMENT_NOT_ALLOWED, and a bank transfer's with
 * BANK_TRANSFER_REVIEW_REQUIRED (its receipt review owns it).
 */
export function canMarkOrderPaid(order: Order): boolean {
  return (
    order.payment.status === "payment-pending" &&
    order.payment.gateway?.toUpperCase() === SETTLEABLE_GATEWAY &&
    !isTerminalStatus(order.order_status)
  )
}

/**
 * The earliest invoice due date on the order, or null. Only an INVOICE order
 * carries one, and a draft converts into a single-shop order with a single
 * invoice, so "earliest" only matters if that ever changes.
 */
export function orderPaymentDueDate(order: Order): string | null {
  const dates = (order.invoices ?? [])
    .map((inv) => inv.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()
  return dates[0] ?? null
}
