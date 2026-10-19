"use client"

import { useLocale } from "next-intl"

import { bindDashboardLocale } from "./dashboard-locale"

/**
 * Binds the dashboard locale before children render, so `formatDate` and
 * `formatMoney` agree with the server HTML on the first client paint.
 * The write is synchronous and not React state: a `useEffect` would run
 * too late and the first paint would hydrate in the browser's language.
 */
export function LocaleScope({ children }: { children: React.ReactNode }) {
  bindDashboardLocale(useLocale())
  return children
}
