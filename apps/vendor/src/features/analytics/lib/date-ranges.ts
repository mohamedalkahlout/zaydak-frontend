// Date-range presets for the analytics dashboard. Each preset resolves to a
// half-open `[start, end)` window where `end` is "now" (so today is included
// as an in-progress bucket, matching Shopify). Dates are computed in the
// browser's local time; the back-end buckets the time series by UTC day/month.

export type RangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "last_month"
  | "this_year"

export const RANGE_PRESETS: RangePreset[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_month",
  "last_month",
  "this_year",
]

export interface DateRange {
  start: Date
  end: Date
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function rangeForPreset(preset: RangePreset, now: Date = new Date()): DateRange {
  const end = now
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case "today":
      return { start: startOfToday, end }
    case "yesterday":
      return { start: addDays(startOfToday, -1), end: startOfToday }
    case "last_7_days":
      return { start: addDays(startOfToday, -6), end }
    case "last_30_days":
      return { start: addDays(startOfToday, -29), end }
    case "last_90_days":
      return { start: addDays(startOfToday, -89), end }
    case "this_month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
    case "last_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1),
      }
    case "this_year":
      return { start: new Date(now.getFullYear(), 0, 1), end }
  }
}

/**
 * Resolve a calendar-day pair picked in the custom range filter to the same
 * half-open `[start, end)` window shape the presets produce. Both picked days
 * are inclusive; the exclusive bound is the midnight after `end`, capped at
 * `now` so a range ending today stays an in-progress window (Shopify
 * behavior). Order-agnostic — a reversed pair is swapped, not rejected.
 */
export function rangeForCustom(
  picked: { start: Date; end: Date },
  now: Date = new Date(),
): DateRange {
  const [first, last] =
    picked.start <= picked.end
      ? [picked.start, picked.end]
      : [picked.end, picked.start]
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate())
  const dayAfterLast = addDays(
    new Date(last.getFullYear(), last.getMonth(), last.getDate()),
    1,
  )
  const end = dayAfterLast > now ? now : dayAfterLast
  // A fully-future pick would invert the window; clamp to an empty one at now.
  return { start: start > end ? end : start, end }
}

/**
 * The immediately-preceding equal-length window — the comparison period the
 * back-end charts against (its `previous_series`). `end` meets the current
 * window's `start`; `start` is one span earlier. Used only for the label on the
 * comparison control, so a partial "today" window resolves to the equivalent
 * slice of yesterday (matching Shopify's "vs. yesterday" copy).
 */
export function previousWindow(range: DateRange): DateRange {
  const span = range.end.getTime() - range.start.getTime()
  return {
    start: new Date(range.start.getTime() - span),
    end: new Date(range.start.getTime()),
  }
}

/**
 * Human label for a resolved window, e.g. "Jun 7 – Jul 6, 2026". `end` is
 * exclusive, so the shown last day is the day containing `end − 1ms` — this
 * renders "yesterday" as one day and never shows tomorrow for today-inclusive
 * windows. `locale` is the app locale (next-intl), not the browser's.
 */
export function formatRangeLabel(range: DateRange, locale?: string): string {
  const lastIncluded = new Date(range.end.getTime() - 1)
  const sameDay =
    range.start.getFullYear() === lastIncluded.getFullYear() &&
    range.start.getMonth() === lastIncluded.getMonth() &&
    range.start.getDate() === lastIncluded.getDate()
  const endLabel = lastIncluded.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  if (sameDay) return endLabel
  const sameYear = range.start.getFullYear() === lastIncluded.getFullYear()
  const startLabel = range.start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  return `${startLabel} – ${endLabel}`
}

/**
 * Format a back-end time-series bucket label (`YYYY-MM-DD` or `YYYY-MM`) for
 * display on the chart axis / tooltip. Pass the dashboard `locale`: without
 * one the browser's own language names the month, so an Arabic dashboard
 * showed "Sep 1" under Arabic figures. A `week` bucket is keyed by the
 * Monday it starts on, so it reads as that day.
 */
export function formatBucketLabel(
  date: string,
  granularity: string,
  locale?: string,
): string {
  const isMonth = granularity === "month" || /^\d{4}-\d{2}$/.test(date)
  // Parse as UTC to match the back-end bucket boundaries.
  const iso = isMonth ? `${date}-01T00:00:00Z` : `${date}T00:00:00Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(locale, {
    timeZone: "UTC",
    month: "short",
    ...(isMonth ? { year: "numeric" } : { day: "numeric" }),
  })
}
