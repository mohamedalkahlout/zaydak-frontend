/**
 * Which lines the *quote* refuses, and by what name to call them.
 *
 * Extracted from the checkout screen because it decides whether the order can
 * be placed at all, and because the distinction it draws is easy to lose:
 * **the cart and the quote refuse different sets.**
 *
 * `CartItem.status` is the cart's own check against sellable stock (tracked
 * quantity only — untracked lines stay `AVAILABLE` at zero). `verifyCheckout`
 * then runs the allocation engine over
 * the shop's locations and can reject a line the cart called `AVAILABLE`:
 * units that exist in the aggregate but sit at no location fulfilling online
 * orders come back `unfulfillable_online`, and units spread one-per-warehouse
 * satisfy a request for three while remaining unplaceable. Every other reason
 * the quote returns — a deleted product, a stale variation, a shortfall — is
 * equally fatal at `createOrder`, which throws `VALIDATION_ERROR` with an
 * `ORDER_NOT_ALLOCATABLE` (or stock) item inside it.
 *
 * So the whole list blocks. Before this, the screen selected
 * `unavailable_products` and read none of it: the quote said the line could
 * not ship, the page submitted it anyway, and the customer got a generic
 * "something went wrong" toast naming nothing they could act on.
 *
 * These are deliberately **not** subtracted from the next verify request.
 * Dropping a line from the quote's input makes it unavailable no longer — it
 * was not asked about — so the set would empty, the line would return, and the
 * two states would alternate on every round trip.
 */

export interface QuoteUnavailableLine {
  product_id: string;
}

export interface NamedLine {
  product_id: string;
  name: string;
}

/** The product ids the quote will not fulfill. Empty when there is no quote yet. */
export function quoteBlockedProductIds(
  unavailable: readonly QuoteUnavailableLine[] | null | undefined,
): Set<string> {
  return new Set((unavailable ?? []).map((line) => line.product_id));
}

/**
 * Those lines by the name the customer put in their cart.
 *
 * Named rather than counted because the quote's verdict is invisible on the
 * cart screen — a line still listed as in stock can be one no location can
 * ship, and "some items are unavailable" leaves the customer guessing which of
 * them to remove. Deduplicated: two variations of one product share a
 * `product_id` and would otherwise be listed twice.
 */
export function blockedLineNames(
  lines: readonly NamedLine[],
  blockedIds: ReadonlySet<string>,
): string[] {
  const names = lines
    .filter((line) => blockedIds.has(line.product_id))
    .map((line) => line.name);
  return [...new Set(names)];
}
