import type { Order, OrderProduct } from "@/features/orders/types"

/**
 * How much of a line is still waiting to ship.
 *
 * `fulfilled_quantity` is only selected by the detail query, so it is optional
 * on the type; a line that never shipped reports 0 rather than NaN.
 */
export function remainingToFulfill(line: OrderProduct): number {
  return Math.max(0, line.order_quantity - (line.fulfilled_quantity ?? 0))
}

/** Total units on the order still waiting to ship. */
export function orderRemainingToFulfill(order: Order): number {
  return order.products.reduce((sum, line) => sum + remainingToFulfill(line), 0)
}

/**
 * Whether the Fulfill action should be offered at all.
 *
 * Mirrors the back-end's `not_fulfillable` guard: a cancelled or refunded order
 * cannot ship, and there must be something left to ship. Deliberately keyed on
 * `order_status` (the terminal states) rather than `fulfillment_status`, since
 * a partially-fulfilled order that is then cancelled must not offer the button.
 */
export function canFulfill(order: Order): boolean {
  if (
    order.order_status === "order-cancelled" ||
    order.order_status === "order-refunded" ||
    order.order_status === "order-failed"
  ) {
    return false
  }
  return orderRemainingToFulfill(order) > 0
}

/** The back-end's refundable window. Anything else has no money to give back. */
export function canRefund(order: Order): boolean {
  return (
    order.order_status === "order-processing" ||
    order.order_status === "order-at-local-facility" ||
    order.order_status === "order-out-for-delivery" ||
    order.order_status === "order-completed"
  )
}

/** Gross value of a line at the quantity being acted on. */
export function lineGrossCents(line: OrderProduct, quantity: number): number {
  return line.unit_price_cents * quantity
}

/**
 * ADVISORY estimate of what a refund of these lines would come to.
 *
 * The authoritative number is computed by the back-end (it allocates the
 * order's discount and tax across the refunded lines, with a last-line
 * remainder correction so the parts sum exactly). We deliberately do NOT send
 * an `amount_cents` override built from this — the client re-deriving money and
 * pinning it is precisely how a quote drifts from the charge. This exists only
 * to tell the merchant roughly what they are about to request; the dialog that
 * actually MOVES the money shows the server's figure, not this one.
 *
 * Shape mirrors the back-end: line gross, minus its proportional share of the
 * order discount, plus its proportional share of the tax on that net base.
 */
export function estimateRefundCents(
  order: Order,
  selected: Array<{ line: OrderProduct; quantity: number }>
): number {
  const orderSubtotal = order.products.reduce(
    (sum, l) => sum + l.unit_price_cents * l.order_quantity,
    0
  )
  if (orderSubtotal <= 0) return 0

  const orderDiscount = order.pricing.discount_cents ?? 0
  const orderTax = order.pricing.tax_cents ?? 0
  const netBase = orderSubtotal - orderDiscount

  let total = 0
  for (const { line, quantity } of selected) {
    if (quantity <= 0) continue
    const gross = lineGrossCents(line, quantity)
    const discount = Math.round(orderDiscount * (gross / orderSubtotal))
    const net = gross - discount
    const tax = netBase > 0 ? Math.round(orderTax * (net / netBase)) : 0
    total += net + tax
  }
  return Math.max(0, total)
}

const FULFILLMENT_STATUSES: ReadonlySet<string> = new Set([
  "unfulfilled",
  "partial",
  "fulfilled",
])

/**
 * Where a fulfillment status's words live, under the `orders` namespace. The
 * words themselves are in `messages/{en,ar}/orders.json`. A missing or unknown
 * status reads as unfulfilled, which is what the order is until something ships.
 */
export function fulfillmentStatusKey(status?: string): string {
  const known = status && FULFILLMENT_STATUSES.has(status) ? status : "unfulfilled"
  return `fulfillmentStatus.${known}`
}

const FINANCIAL_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "voided",
])

/**
 * The `orders` message key for a financial status, or null for one that has no
 * words — the detail header then shows no badge for it rather than a raw id.
 */
export function financialStatusKey(status?: string): string | null {
  return status && FINANCIAL_STATUSES.has(status)
    ? `financialStatus.${status}`
    : null
}
