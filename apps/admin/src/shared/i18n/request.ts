import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, resolveLocale } from "./config"

/**
 * Resolves the active locale per request from the `locale` cookie — there is no
 * URL-based routing. Messages load through a dynamic import so only the chosen
 * catalog reaches the server bundle.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const locale = resolveLocale(cookieValue ?? DEFAULT_LOCALE)

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
