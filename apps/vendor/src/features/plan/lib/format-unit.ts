/**
 * Rendering a quota in the unit it is actually sold in.
 *
 * This is where `billing_unit` stops being metadata and starts earning its
 * keep: "820 / 1,000 images", "48,210 / 100,000 characters" and "31 / 50 GB"
 * all come out of one component because the server says which unit each
 * capability counts in.
 */

import type { Translate } from "@/shared/i18n/translator"

/** Storage is metered in megabytes — `limit_value` is INT4 and bytes overflow at 2.1 GB. */
const MB_PER_GB = 1024

export function formatQuantity(value: number, unit: string, locale = "en"): string {
  if (unit === "megabyte") return formatStorage(value, locale)
  return new Intl.NumberFormat(locale).format(value)
}

/**
 * Megabytes read as GB once they pass a gigabyte, because a plan sold as
 * "50 GB" should not display as "51200".
 */
export function formatStorage(megabytes: number, locale = "en"): string {
  if (megabytes >= MB_PER_GB) {
    const gb = megabytes / MB_PER_GB
    // One decimal below 10 GB, none above — "1.4 GB" is useful, "204.8 GB" is noise.
    const digits = gb < 10 ? 1 : 0
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(gb)} GB`
  }
  return `${new Intl.NumberFormat(locale).format(megabytes)} MB`
}

/** The `BillingUnit` values with a noun under `plan.units` in the catalogue. */
const UNIT_NOUNS = new Set([
  "image",
  "video",
  "character",
  "token",
  "product",
  "variant",
  "request",
  "document",
  "seat",
  "coupon",
  "collection",
])

/**
 * The unit's own label, for the "X of Y <unit>" line, from the `plan`
 * translator — the noun agrees with `count`, which in Arabic is more than a
 * trailing "s".
 *
 * Storage returns an empty label because `formatStorage` already carries GB/MB
 * in the number — appending "megabytes" would read "50 GB megabytes". A unit
 * the server added after this build falls back to the English noun rather
 * than to a message key.
 */
export function unitLabel(unit: string, count: number, t: Translate): string {
  if (unit === "none" || unit === "megabyte") return ""
  if (UNIT_NOUNS.has(unit)) return t(`units.${unit}`, { count })
  const plural = count === 1 ? "" : "s"
  return `${unit}${plural}`
}

/** "resets 1 Sep" — what a vendor at their cap actually wants to know. */
export function formatReset(
  iso: string | null | undefined,
  locale = "en",
): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date)
}

/** Money crosses the API as integer cents; the division happens once, here. */
export function formatPrice(
  cents: number,
  currency: string,
  locale = "en",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}
