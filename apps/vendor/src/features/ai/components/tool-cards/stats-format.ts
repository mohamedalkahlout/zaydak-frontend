/**
 * Formatting shared by the sales-stats tool cards (`get_shop_stats`,
 * `get_custom_range_stats`).
 *
 * Tool payloads carry money in **major units** — the back-end converts at the
 * tool boundary because the model writes prose and has no formatter — so the
 * amounts here are printed as they arrive, never divided by 100.
 */

export function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

/** A share with at most one decimal, as the tool sends `share_pct`. */
export function formatShare(pct: number): string {
  return pct.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * A `YYYY-MM-DD` calendar date as a UTC midnight, so formatting it in UTC
 * prints the same day whatever the browser's zone is. The tool's dates are
 * already the shop's local calendar days; converting them again would move
 * a Riyadh date back a day for a vendor browsing from New York.
 */
function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = ISO_DATE.exec(value)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

function dateFormat(locale: "ar" | "en", withYear: boolean) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
    // The amounts beside it print Latin digits; a date in Arabic-Indic ones
    // next to them reads as two different number systems in one card.
    numberingSystem: "latn",
  })
}

/** One calendar date ("Sep 29"), or null when the value is not one. */
export function formatCalendarDate(
  value: string | null | undefined,
  locale: "ar" | "en",
  withYear = false,
): string | null {
  const date = parseCalendarDate(value)
  return date ? dateFormat(locale, withYear).format(date) : null
}

/**
 * Two inclusive calendar dates as one localized range ("Sep 23 – 29"),
 * collapsed to a single date when they are the same day. Null when either
 * is not a date, so the caller can fall back to the raw strings.
 */
export function formatCalendarRange(
  from: string | null | undefined,
  to: string | null | undefined,
  locale: "ar" | "en",
  withYear = false,
): string | null {
  const start = parseCalendarDate(from)
  const end = parseCalendarDate(to)
  if (!start || !end) return null
  const format = dateFormat(locale, withYear)
  if (start.getTime() === end.getTime()) return format.format(start)
  try {
    return format.formatRange(start, end)
  } catch {
    // An engine that refuses a reversed range, or has no formatRange.
    return `${format.format(start)} – ${format.format(end)}`
  }
}
