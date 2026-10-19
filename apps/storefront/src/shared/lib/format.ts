/**
 * Display formatters for the storefront.
 *
 * **Money crosses the API as integer cents, never as a float.** Scaling to
 * major units happens here, at the last possible moment, and nowhere else — a
 * component that divides by 100 inline is how a rounding bug gets in.
 *
 * Unlike the admin console's formatter this one is *always* currency-aware.
 * The console renders withdrawals whose currency the query cannot see, so it
 * deliberately prints a bare number; a storefront that showed a bare number
 * would be showing a customer a price with no unit. Every caller here passes
 * the shop's ISO-4217 code, which is why `Shop.currency` exists.
 */

const FALLBACK_CURRENCY =
  process.env.NEXT_PUBLIC_FALLBACK_CURRENCY || "SAR"

/**
 * `12345`, `"SAR"` → `SAR 123.45` (or `١٢٣٫٤٥ ر.س.` under `ar`).
 *
 * `narrow` asks for the shortest form of the currency marker the locale has,
 * and is used only by the tile's price chip, which shares a line with a
 * product title and pays for every character in name width. It is a *request*,
 * not a promise: `narrowSymbol` falls back to the standard marker wherever a
 * locale has no shorter one, so `SAR` under `en` prints unchanged while `USD`
 * becomes `$`. That is why it is an option here rather than the default
 * everywhere — a cart line and an order total have the room, and the full
 * marker is the less ambiguous of the two.
 */
export function formatMoney(
  cents: number,
  currency: string | null | undefined,
  locale: string,
  { narrow = false }: { narrow?: boolean } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || FALLBACK_CURRENCY,
    currencyDisplay: narrow ? "narrowSymbol" : "symbol",
    // Most storefront amounts are whole units; showing `.00` on every tile
    // makes a grid noisier without telling anyone anything. Fractions still
    // print in full when there are any.
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * The discount between a `was` price and a `now` price, as a whole percent.
 *
 * Returns null when there is no genuine markdown, so a caller can render
 * nothing rather than a `-0%` badge. Rounds *down*: a 49.6% cut advertised as
 * 50% is the kind of rounding a customer is entitled to be annoyed by.
 */
export function discountPercent(
  compareAtCents: number | null | undefined,
  sellingCents: number | null | undefined,
): number | null {
  if (!compareAtCents || !sellingCents) return null
  if (compareAtCents <= sellingCents) return null
  const pct = Math.floor(((compareAtCents - sellingCents) / compareAtCents) * 100)
  return pct > 0 ? pct : null
}

/** Renders an ISO-8601 timestamp; returns an em dash for null/invalid. */
export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
}

/** Date *and* time — order history, where two orders can share a day. */
export function formatDateTime(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

/** `1234` → `1,234`. Used for review counts and view counts. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}
