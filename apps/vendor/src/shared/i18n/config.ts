/**
 * Shared locale configuration for the vendor dashboard.
 *
 * The app is NOT served from `/[locale]` segments — we resolve the
 * active locale from the `locale` cookie instead (same cookie the
 * Apollo locale link reads, so GraphQL responses stay in sync with the
 * rendered UI).
 */

export const SUPPORTED_LOCALES = ["en", "ar"] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = "en"

/** Cookie that persists the chosen locale across requests + tabs. */
export const LOCALE_COOKIE_NAME = "locale"

/** Map each locale to its text direction so `<html dir>` is correct. */
export const LOCALE_DIRECTIONS: Record<SupportedLocale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
}

/** Display labels for the locale switcher. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  ar: "العربية",
}

/** Narrow an unknown value to a supported locale, falling back to default. */
export function resolveLocale(raw: string | null | undefined): SupportedLocale {
  if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as SupportedLocale
  }
  return DEFAULT_LOCALE
}
