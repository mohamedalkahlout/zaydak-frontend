/**
 * Does a cart need delivering?
 *
 * Extracted from the checkout screen because it decides something a customer
 * feels directly: whether they are asked for a shipping address at all. A cart
 * of nothing but digital goods has nowhere to be sent, and asking anyway is how
 * a course ends up blocked behind an address it will never use.
 *
 * **This mirrors the server's own predicate** (`lineShips` in the back-end's
 * `shipping-fee.helper.ts`), keyed on `product_type` — NOT on `is_digital`.
 * The two used to disagree: this file read `is_digital`, so boxed software
 * (`SIMPLE` + `is_digital`, a physical parcel carrying digital content) had
 * its address form hidden here while the server rightly charged to ship it.
 * `product_type` is what the product fundamentally IS, and it is decisive:
 * a `DIGITAL` line never ships, whatever `requires_shipping` says — that flag
 * defaults to `true` server-side and is not cleared when a vendor marks a
 * product digital.
 */
export interface ShippableLine {
  requires_shipping: boolean
  /** `SIMPLE` | `VARIABLE` | `DIGITAL` — the server's Prisma enum, as a string. */
  product_type: string
}

/** One line ships when it is not DIGITAL and the vendor has not opted it out. */
export function lineShips(line: ShippableLine): boolean {
  if (line.product_type === "DIGITAL") return false
  return line.requires_shipping !== false
}

/**
 * True when at least one line ships.
 *
 * An empty cart returns false — there is nothing to deliver, and the checkout
 * screen has its own empty state before this is ever consulted.
 */
export function cartNeedsShipping(lines: readonly ShippableLine[]): boolean {
  return lines.some(lineShips)
}

/**
 * Whether to show the "digital only — no address" note.
 *
 * Needs at least one *orderable* line that does not ship. An empty orderable
 * list (every line blocked as unavailable / out of stock) is not digital —
 * that is how a coffee-shop product with inventory tracking off was labelled
 * "Everything in this order is digital" while the real issue was stock status.
 */
export function isDigitalOnlyOrder(orderable: readonly ShippableLine[]): boolean {
  return orderable.length > 0 && !cartNeedsShipping(orderable)
}
