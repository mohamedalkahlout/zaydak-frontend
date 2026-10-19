import type { Order, OrderUnappliedPayment } from "@/features/orders/types"
import { isTerminalStatus } from "@/features/orders/lib/list/status-transitions"
import { validationErrors } from "@/shared/lib/validation-errors"

/**
 * The rules the order screen's "Payments not applied to this order" card
 * follows. The server re-checks every one of them under the order lock
 * (`refundUnappliedPayment`); these only decide what the merchant is offered.
 */

const REASONS: ReadonlySet<string> = new Set([
  "paid_after_close",
  "amount_mismatch",
  "duplicate_charge",
])

/** The message suffix for a reason; one the server invents reads as `other`. */
export function unappliedReasonKey(reason: string): string {
  return REASONS.has(reason) ? reason : "other"
}

/**
 * Whether the merchant may refund this payment now: nothing under way or done
 * (never asked, or the last attempt failed), and either a second charge on a
 * paid order, or an order that is closed or was paid another way. A different
 * amount on an order still open is cancelled first.
 */
export function canRefundUnappliedPayment(
  order: Pick<Order, "order_status" | "payment">,
  payment: Pick<OrderUnappliedPayment, "reason" | "refund_status">,
): boolean {
  if (payment.refund_status !== "none" && payment.refund_status !== "failed") {
    return false
  }
  return (
    payment.reason === "duplicate_charge" ||
    isTerminalStatus(order.order_status) ||
    order.payment.status === "payment-success"
  )
}

/** A refund the provider has not confirmed or settled yet: ask it again. */
export function canCheckAgain(
  payment: Pick<OrderUnappliedPayment, "refund_status">,
): boolean {
  return (
    payment.refund_status === "requested" || payment.refund_status === "pending"
  )
}

/** Refundable once the order is closed: the screen says "cancel first". */
export function needsCancelFirst(
  order: Pick<Order, "order_status" | "payment">,
  payment: Pick<OrderUnappliedPayment, "reason" | "refund_status">,
): boolean {
  return (
    (payment.refund_status === "none" || payment.refund_status === "failed") &&
    !canRefundUnappliedPayment(order, payment)
  )
}

const KNOWN_ERRORS: ReadonlySet<string> = new Set([
  "charge_disputed",
  "amount_too_large",
  "unconfirmed",
  // Refunded in full by something else (a goods refund took the charge): the
  // server records it failed rather than done, so the money is reviewed.
  "charge_already_refunded",
])

/**
 * The `orders.unappliedPayments` key for why the last attempt did not settle.
 * The provider's own codes are many; the ones a merchant can act on get their
 * own sentence, the rest a generic one.
 */
export function refundErrorKey(code?: string | null): string {
  return `error.${code && KNOWN_ERRORS.has(code) ? code : "generic"}`
}

const KNOWN_REFUSALS: ReadonlySet<string> = new Set([
  "ORDER_STILL_OPEN",
  "REFUND_IN_PROGRESS",
  "NOT_UNAPPLIED",
  "NO_PAYMENT_REFERENCE",
])

/**
 * The `orders.unappliedPayments` key for a refused request. A throw is not a
 * provider's answer (that comes back as data); it is the server declining
 * before anything moved, or the request not completing at all — and then the
 * card is refetched, because only the server knows where the refund stands.
 */
export function refusalKey(err: unknown): string {
  const code = validationErrors(err).find(
    (e) => e.code && KNOWN_REFUSALS.has(e.code),
  )?.code
  return `refusal.${code ?? "generic"}`
}
