import { createTranslator } from "next-intl"

import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "./config"
import type { Translate } from "./translator"

/**
 * A translator for code that runs outside React: the Apollo error link,
 * `forceLogout`, anything that raises a toast from a promise callback.
 *
 * `useTranslations` needs a component; these callers have none, and until
 * this existed they wrote their toasts in English for every merchant. The
 * locale comes from `<html lang>` rather than the cookie, because that is the
 * language the page was actually rendered in — a cookie changed in another tab
 * would otherwise make one toast disagree with the screen under it.
 *
 * The catalogue is imported lazily. Every caller is already on an error path
 * inside an async callback, so the one extra chunk is fetched only when a toast
 * is about to be shown, and never on a page that raises none.
 */
const CATALOGUES: Record<SupportedLocale, () => Promise<{ default: object }>> = {
  en: () => import("@/shared/messages/en"),
  ar: () => import("@/shared/messages/ar"),
}

export function documentLocale(): SupportedLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE
  return resolveLocale(document.documentElement.lang)
}

export async function translatorFor(namespace: string): Promise<Translate> {
  const locale = documentLocale()
  const messages = (await CATALOGUES[locale]()).default
  return createTranslator({
    locale,
    messages: messages as Parameters<typeof createTranslator>[0]["messages"],
    namespace: namespace as never,
  }) as unknown as Translate
}
