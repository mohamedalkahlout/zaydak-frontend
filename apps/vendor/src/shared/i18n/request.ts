import { cookies } from "next/headers"
import type { AbstractIntlMessages } from "next-intl"
import { getRequestConfig } from "next-intl/server"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  type SupportedLocale,
} from "./config"

/**
 * Resolves the active locale per request. The app does NOT use URL-
 * based routing — locale lives in the `locale` cookie, so the only
 * input here is `await cookies()`. When the cookie is missing (first
 * visit) or unsupported, we fall back to `DEFAULT_LOCALE`.
 *
 * Messages are loaded via dynamic import so only the chosen locale's
 * catalog is read. Each locale is a folder with one JSON file per
 * namespace, assembled by its `index.ts`.
 */
const CATALOGUES: Record<SupportedLocale, () => Promise<{ default: AbstractIntlMessages }>> = {
  en: () => import("../messages/en"),
  ar: () => import("../messages/ar"),
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const locale = resolveLocale(cookieValue ?? DEFAULT_LOCALE)

  return {
    locale,
    messages: (await CATALOGUES[locale]()).default,
  }
})
