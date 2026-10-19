import { dashboardLocale } from "@/shared/i18n/dashboard-locale"
import { useActiveShopStore } from "@/shared/stores/active-shop"

function filled(value: string | null | undefined): string {
  return value && value.trim() ? value : ""
}

/**
 * Normalize a possibly-translatable value (string | {en, ar}) to a string
 * in the dashboard's language. An empty side falls through to the other.
 */
export function translatable(
  value: string | { en?: string; ar?: string } | null | undefined,
  locale?: string,
): string {
  if (!value) return ""
  if (typeof value === "string") return value
  const lang = (locale ?? dashboardLocale()) === "ar" ? "ar" : "en"
  const primary = filled(value[lang])
  const fallback = filled(lang === "ar" ? value.en : value.ar)
  return primary || fallback
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
}

export function formatDate(iso: string, locale?: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale ?? dashboardLocale(), DATE_FORMAT)
}

export function formatMoney(
  value: number | null | undefined,
  currency?: string,
  locale?: string,
): string {
  if (value == null) return "—"
  // Pass `currency` from `useShopCurrency()` when this string is server
  // rendered. The store below is empty during SSR (SAR) and filled from
  // localStorage after mount, which is a hydration mismatch.
  const resolvedCurrency =
    currency || useActiveShopStore.getState().currency || "SAR"
  return new Intl.NumberFormat(locale ?? dashboardLocale(), {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Narrow currency mark in a locale, e.g. SAR + ar → "ر.س". */
export function currencySuffix(currency: string, locale?: string): string {
  try {
    const part = new Intl.NumberFormat(locale ?? dashboardLocale(), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")
    return part?.value ?? currency
  } catch {
    return currency
  }
}

/** Money is stored as integer cents; divide by 100 before formatting. */
export function formatMoneyCents(
  cents: number | null | undefined,
  currency?: string,
  locale?: string,
): string {
  if (cents == null) return "—"
  return formatMoney(cents / 100, currency, locale)
}

/** Cents → major unit (e.g. 1250 → 12.5). Nullish inputs coerce to 0. */
export function centsToMajor(cents: number | null | undefined): number {
  return (cents ?? 0) / 100
}

/** Major unit → cents, rounded to the nearest integer. */
export function majorToCents(amount: number | null | undefined): number {
  return Math.round((amount ?? 0) * 100)
}

/** Basis points → percent (e.g. 1550 bps → 15.5). Nullish inputs coerce to 0. */
export function bpsToPercent(bps: number | null | undefined): number {
  return (bps ?? 0) / 100
}

/** Percent → basis points, rounded to the nearest integer. */
export function percentToBps(percent: number | null | undefined): number {
  return Math.round((percent ?? 0) * 100)
}

/** Alias for `formatMoneyCents` matching the project's Money Phase 2 naming. */
export const formatCents = formatMoneyCents

/** Extract 2-letter initials from a display name. */
export function initials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}
