// Resolves a target period (the current week/month/quarter/year, or a custom
// day pair) to the concrete window it tracks, plus a human label and the number
// of whole days remaining. Used by the create-target modal's live preview so
// the gauge card can show "Time period" and "Days left" before the target is
// saved — the back-end owns the authoritative window once it exists.

import type { TargetPeriod } from "../types"

const DAY_MS = 86_400_000

export interface PeriodPreview {
  start: Date
  end: Date
  /** e.g. "July 2026", "Q3 2026", "2026", "Jul 6 – 12, 2026". */
  label: string
  /** Whole days between today (exclusive) and the last day of the period. */
  daysLeft: number
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Parse a `yyyy-mm-dd` value from an `<input type="date">` as a LOCAL calendar
 * day. `new Date("yyyy-mm-dd")` parses as UTC midnight, which reads back as the
 * previous day west of UTC — this keeps custom dates on the same day the rest
 * of the app (preset windows, rangeForCustom) uses.
 */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Jul 6 – 12, 2026" style range label (end inclusive). */
function formatDayRange(start: Date, endInclusive: Date, locale?: string): string {
  const sameMonth =
    start.getFullYear() === endInclusive.getFullYear() &&
    start.getMonth() === endInclusive.getMonth()
  const sameYear = start.getFullYear() === endInclusive.getFullYear()
  const startLabel = start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  const endLabel = endInclusive.toLocaleDateString(locale, {
    ...(sameMonth ? {} : { month: "short" }),
    day: "numeric",
    year: "numeric",
  })
  return `${startLabel} – ${endLabel}`
}

/**
 * Resolve a period to its window/label/days-left. Custom periods read the
 * `yyyy-mm-dd` inputs; a missing/invalid custom pair yields an empty window
 * with a dash label so the preview stays sane while the user is still typing.
 */
export function resolvePeriodPreview(
  period: TargetPeriod,
  opts: { start?: string; end?: string; locale?: string; now?: Date } = {},
): PeriodPreview {
  const now = opts.now ?? new Date()
  const today = startOfDay(now)
  const locale = opts.locale
  const year = now.getFullYear()

  let start: Date
  let end: Date
  let label: string

  switch (period) {
    case "WEEK": {
      // Week starting Sunday, matching the calendar's default first day.
      start = new Date(today)
      start.setDate(today.getDate() - today.getDay())
      end = new Date(start)
      end.setDate(start.getDate() + 7)
      label = formatDayRange(start, new Date(end.getTime() - DAY_MS), locale)
      break
    }
    case "MONTH": {
      start = new Date(year, now.getMonth(), 1)
      end = new Date(year, now.getMonth() + 1, 1)
      label = start.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      })
      break
    }
    case "QUARTER": {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(year, q * 3, 1)
      end = new Date(year, q * 3 + 3, 1)
      label = `Q${q + 1} ${year}`
      break
    }
    case "YEAR": {
      start = new Date(year, 0, 1)
      end = new Date(year + 1, 0, 1)
      label = String(year)
      break
    }
    case "CUSTOM": {
      const s = opts.start ? parseLocalDate(opts.start) : null
      const e = opts.end ? parseLocalDate(opts.end) : null
      if (s && e) {
        start = s
        end = new Date(e.getTime() + DAY_MS) // end inclusive → exclusive
        label = formatDayRange(start, e, locale)
      } else {
        start = today
        end = today
        label = "—"
      }
      break
    }
  }

  const lastIncluded = new Date(end.getTime() - DAY_MS)
  const daysLeft = Math.max(
    0,
    Math.round((startOfDay(lastIncluded).getTime() - today.getTime()) / DAY_MS),
  )

  return { start, end, label, daysLeft }
}
