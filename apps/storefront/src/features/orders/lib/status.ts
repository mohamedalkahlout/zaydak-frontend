/**
 * Order status, as a customer reads it.
 *
 * The API sends **three orthogonal statuses** and a shopper does not think in
 * three: `order_status` (the lifecycle), `financial_status` (money) and
 * `fulfillment_status` (shipping). Collapsing them for display is the whole job
 * of this module, and the precedence is what makes it honest — cancelled and
 * refunded outrank everything, because an order that has been refunded is not
 * "shipped" no matter what the fulfilment column says.
 *
 * The values are lowercase strings, not enums: `OrderStatus` and friends are
 * registered as GraphQL enums but the fields are typed `String!`, so what
 * the lifecycle and payment values arrive with `order-` / `payment-` prefixes,
 * while financial and fulfillment statuses use `paid` / `unfulfilled`.
 */

export type DisplayStatus =
  | "cancelled"
  | "refunded"
  | "completed"
  | "processing"
  | "pending"

export function displayStatus(order: {
  order_status: string
  financial_status: string
}): DisplayStatus {
  const lifecycle = order.order_status.toLowerCase().replace(/^order[-_]/, "")
  const money = order.financial_status.toLowerCase()

  if (lifecycle.includes("cancel")) return "cancelled"
  if (money === "refunded" || lifecycle === "refunded") return "refunded"
  if (lifecycle === "completed" || lifecycle === "delivered") return "completed"
  if (lifecycle === "pending" && ["pending", "authorized", "failed"].includes(money)) return "pending"
  return "processing"
}

/** The i18n key under the `orders` namespace for a display status. */
export const STATUS_LABEL_KEY: Record<DisplayStatus, string> = {
  pending: "statusPending",
  processing: "statusProcessing",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  refunded: "statusRefunded",
}

/** Tailwind classes for the status chip, keyed the same way. */
export const STATUS_CHIP_CLASS: Record<DisplayStatus, string> = {
  pending: "bg-secondary text-muted-foreground",
  processing: "bg-shop-accent-soft text-shop-accent",
  completed: "bg-shop-in-stock/12 text-shop-in-stock",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
}

/**
 * Whether the customer may still cancel.
 *
 * `cancelOrder` is `JwtAuthGuard` and the service refuses anything already
 * shipped or completed. Mirroring that here is UX only — the button is hidden
 * rather than shown-and-rejected — and the back-end remains the boundary.
 */
export function canCancel(order: {
  order_status: string
  fulfillment_status: string
}): boolean {
  const lifecycle = order.order_status.toLowerCase().replace(/^order[-_]/, "")
  const fulfillment = order.fulfillment_status.toLowerCase()
  if (lifecycle.includes("cancel")) return false
  if (lifecycle === "completed" || lifecycle === "delivered") return false
  if (["refunded", "failed"].includes(lifecycle)) return false
  return fulfillment === "unfulfilled"
}

/**
 * Whether the order page offers to pay by card again.
 *
 * A card checkout cancelled on Stripe comes back to this page, and nothing on
 * it could retry. Offered only while `createPaymentLink` would accept it: a
 * card order, not paid (nor paid and flagged `payment-mismatch`, where a
 * second payment is a second charge), and not closed — an order voided when
 * its session expired has had its stock returned, and the back-end refuses
 * those (`ORDER_CLOSED`), as a chat's pay link does.
 */
export function canPayByCard(order: {
  order_status: string
  payment: { gateway?: string | null; status: string }
}): boolean {
  if (order.payment.gateway?.toUpperCase() !== "STRIPE") return false
  const lifecycle = order.order_status.toLowerCase().replace(/^order[-_]/, "")
  if (["cancelled", "failed", "refunded"].includes(lifecycle)) return false
  const money = order.payment.status.toLowerCase()
  return ["payment-pending", "pending", "payment-failed", "failed"].includes(
    money,
  )
}

/**
 * The i18n key under `orders` for a payment status.
 *
 * **Every status the API can send has a row.** The order page falls back to
 * "Payment pending" for a status it does not know, and that fallback used to
 * be reached by half of them — a cash sale, a wallet payment and a card
 * payment the shop was checking all read as unpaid. `status.test.ts` walks the
 * back-end's `PaymentStatus` enum (and `payment-mismatch`, which is not a
 * member of it), so a status added there fails here instead of falling back.
 *
 * `payment-mismatch` is worded for the shopper: money arrived that did not fit
 * the order and the shop has been told. The merchant's screen calls it "Refund
 * needed"; to the person who paid, it is a payment the shop is checking.
 */
export const PAYMENT_LABEL_KEY: Record<string, string> = {
  pending: "paymentPending",
  authorized: "paymentPending",
  paid: "paymentPaid",
  failed: "paymentFailed",
  "payment-pending": "paymentPending",
  "payment-processing": "paymentProcessing",
  "payment-awaiting-for-approval": "paymentAwaitingApproval",
  "payment-success": "paymentPaid",
  "payment-cash-on-delivery": "paymentOnDelivery",
  "payment-cash": "paymentPaidCash",
  "payment-wallet": "paymentPaidWallet",
  "payment-mismatch": "paymentChecking",
  "payment-failed": "paymentFailed",
  // The API's value is `payment-reversal` (`PaymentStatus.REVERSAL`). This row
  // was keyed `payment-reversed`, which nothing sends, so a reversed payment
  // fell through to the caller's "Payment pending" fallback.
  "payment-reversal": "paymentRefunded",
  "payment-refunded": "paymentRefunded",
}

/**
 * Whether a payment status is the refunded stray payment.
 *
 * `payment-refunded` has one writer: a card payment that could not be applied
 * to its order — it arrived after the order had closed, or did not fit it —
 * was sent back to the card, and the order's `payment-mismatch` flag was
 * lifted. The API only does that on a closed order, so such an order is never
 * payable again: `canPayByCard` refuses it, the chat sends no link for it and
 * its pay link answers `CLOSED`.
 */
export function isPaymentRefunded(status: string | null | undefined): boolean {
  return status?.toLowerCase() === "payment-refunded"
}

/**
 * Whether the order's money was given back, whichever way.
 *
 * `financial_status` is `refunded` both for an order refunded in full and for
 * the refunded stray payment above (the API derives it from either), so the
 * order list — which selects no `payment` — can still say so. The payment
 * status is read as well for a caller that has it and an older API that did
 * not yet derive the first from the second.
 */
export function moneyRefunded(order: {
  financial_status: string
  payment?: { status?: string | null } | null
}): boolean {
  return (
    order.financial_status.toLowerCase() === "refunded" ||
    isPaymentRefunded(order.payment?.status)
  )
}

export const FULFILLMENT_LABEL_KEY: Record<string, string> = {
  unfulfilled: "fulfillmentUnfulfilled",
  partial: "fulfillmentPartial",
  fulfilled: "fulfillmentFulfilled",
}

/**
 * Per-shipment status — the parcel's own lifecycle, distinct from the order's
 * `fulfillment_status` above (an order can be "Partly shipped" while its one
 * parcel so far is already "Delivered").
 */
export const SHIPMENT_LABEL_KEY: Record<string, string> = {
  pending: "shipmentPending",
  processing: "shipmentProcessing",
  shipped: "shipmentShipped",
  delivered: "shipmentDelivered",
  cancelled: "shipmentCancelled",
}

/**
 * Renders a localized payment gateway label, translating standard gateways
 * including CASH, INVOICE, BANK_TRANSFER, etc.
 */
export function paymentGatewayLabel(
  gateway: string | null | undefined,
  tCheckout: (key: string) => string,
): string {
  const norm = gateway?.toUpperCase()
  switch (norm) {
    case "BANK_TRANSFER":
      return tCheckout("paymentBank")
    case "CASH_ON_DELIVERY":
      return tCheckout("paymentCod")
    case "STRIPE":
      return tCheckout("paymentCard")
    case "CASH":
      return tCheckout("paymentCash")
    case "INVOICE":
      return tCheckout("paymentInvoice")
    case "FULL_WALLET_PAYMENT":
      return tCheckout("paymentWallet")
    default:
      return gateway || "—"
  }
}

/**
 * The earliest invoice due date on the order, or null. Only an INVOICE order
 * carries one.
 */
export function orderPaymentDueDate(order: {
  invoices?: Array<{ due_date?: string | null }> | null
}): string | null {
  const dates = (order.invoices ?? [])
    .map((inv) => inv.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()
  return dates[0] ?? null
}
