import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "./config"

/**
 * The locale `formatDate` / `formatMoney` / `translatable` format in.
 *
 * `toLocaleString(undefined)` follows the browser, so an Arabic dashboard on
 * an English browser rendered English dates — and the server render (no
 * browser at all) could not agree with the client. Two writers share this
 * module:
 *
 * - On the server, `request-locale.ts` registers a per-request getter
 *   (`React.cache`). That is what a client component's server render reads,
 *   so two requests in flight cannot swap each other's language.
 * - In the browser, `LocaleScope` binds `useLocale()` during its own render,
 *   before its children, which is the same value the server put on `<html lang>`.
 */
let bound: SupportedLocale | null = null
let serverGetter: (() => SupportedLocale | null) | null = null

export function registerServerLocaleGetter(
  getter: () => SupportedLocale | null,
): void {
  serverGetter = getter
}

/** Bind the locale for the current client render. */
export function bindDashboardLocale(locale: string): void {
  bound = resolveLocale(locale)
}

/** Test helper. Production code never clears a locale mid-request. */
export function resetDashboardLocale(): void {
  bound = null
}

export function dashboardLocale(): SupportedLocale {
  const fromServer = serverGetter?.() ?? null
  if (fromServer) return fromServer
  if (bound) return bound
  if (typeof document !== "undefined") {
    return resolveLocale(document.documentElement.lang)
  }
  return DEFAULT_LOCALE
}
