import { cache } from "react"

import { resolveLocale, type SupportedLocale } from "./config"
import {
  bindDashboardLocale,
  registerServerLocaleGetter,
} from "./dashboard-locale"

/**
 * Per-request locale for code that formats during the server render.
 * Imported only from the root layout (a Server Component), so `cache` never
 * enters the browser bundle. The getter is registered on the shared module
 * the client components' server render already uses.
 */
const bucket = cache(() => ({ locale: null as SupportedLocale | null }))

registerServerLocaleGetter(() => bucket().locale)

export function bindRequestLocale(locale: string): void {
  const resolved = resolveLocale(locale)
  bucket().locale = resolved
  bindDashboardLocale(resolved)
}
