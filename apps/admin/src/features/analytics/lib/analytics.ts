/**
 * Helpers for the platform analytics screen.
 *
 * **Every money figure on this screen is integer cents.** It used to carry two
 * units at once — `analytics`/`yearlySales`/`topProducts` sent major units
 * because the back-end applied `fromCents`, while `usageSummary`/
 * `usageTopShops` sent integer `cost_cents` — and mixing them up misreported
 * our provider spend by 100x. The revenue half now sends cents too
 * (`total_revenue_cents`, `total_cents`, `total_sales_cents`), so the grouped
 * amounts all render through the console-wide `formatAmountCents` in
 * `shared/lib/format`, and the only thing left here is the compact bar-axis
 * variant below. No component divides by 100 inline.
 */

/** A plain count, grouped for the locale. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

/**
 * Compact amount for a bar-chart axis, from integer cents: `1234567` →
 * `12.3K`. Falls back to the grouped form below 1000 major units so small
 * numbers stay exact. The scaling happens here, not at the call site.
 */
export function formatCompactCents(cents: number, locale: string): string {
  const value = cents / 100
  if (Math.abs(value) < 1000) {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(value)
  }
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * A `JSON` name field (`{ en, ar }`) rendered for display.
 *
 * The admin console is bilingual, so unlike the vendor dashboard's version this
 * one takes the active locale and prefers it, falling back to the other language
 * rather than always showing English.
 */
export function translatedName(
  value: unknown,
  locale: string,
): string {
  if (!value) return "—"
  if (typeof value === "string") return value
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const preferred = record[locale]
    if (typeof preferred === "string" && preferred) return preferred
    for (const key of ["en", "ar"]) {
      const fallback = record[key]
      if (typeof fallback === "string" && fallback) return fallback
    }
  }
  return "—"
}

/**
 * Bar width as a percentage of the largest value in the set.
 *
 * Floors at 2% for any non-zero value so a real-but-tiny month stays visible
 * instead of rendering as nothing, and returns 0 for a true zero so an empty
 * month is honestly empty.
 */
export function barShare(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.max(2, (value / max) * 100)
}

/** Localized short month names, index 0 = January. Derived from the locale rather than hardcoded so the Arabic console gets Arabic months. */
export function monthLabels(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: "short" })
  // 2021 is an arbitrary non-leap year; only the month is read.
  return Array.from({ length: 12 }, (_, i) =>
    format.format(new Date(2021, i, 1)),
  )
}

/** Start of a rolling window, N days back. Call from an event or a state initializer — never in a render body, where it would change identity every pass and defeat the Apollo cache. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/** The four years offered by the year picker, newest first. */
export function selectableYears(currentYear: number): number[] {
  return [0, 1, 2, 3].map((offset) => currentYear - offset)
}
