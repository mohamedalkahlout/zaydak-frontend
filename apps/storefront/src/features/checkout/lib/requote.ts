import { errorCodeOf } from "@/shared/lib/validation-errors"

/**
 * The refusals that mean "the price is not what you were shown", which the
 * checkout answers by pricing the order again rather than with a toast alone.
 *
 * `createOrder` prices the order from scratch inside its own transaction and
 * refuses rather than charge more than the total the shopper confirmed:
 *
 * - `CHECKOUT_EXPECTATION_FAILED` — the order would cost more than
 *   `expected_total_cents`: a negotiated price ran out, a sale ended or a
 *   price was edited between the quote and the click.
 * - `NEGOTIATION_OFFER_EXPIRED` — a line's negotiated price lapsed and no
 *   confirmed total came with the order, so the back-end could not tell
 *   whether the shopper had seen the new price.
 *
 * Either way nothing was written, and the next quote shows the real total.
 */
const REQUOTE_CODES = new Set([
  "CHECKOUT_EXPECTATION_FAILED",
  "NEGOTIATION_OFFER_EXPIRED",
])

export function needsRequote(err: unknown): boolean {
  const code = errorCodeOf(err)
  return code !== null && REQUOTE_CODES.has(code)
}
