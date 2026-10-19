"use client"

import { useEffect } from "react"
import { useLocale } from "next-intl"
import { z } from "zod"
import { ar, en } from "zod/locales"

import { resolveLocale, type SupportedLocale } from "./config"

/**
 * zod's own messages, in the dashboard's language.
 *
 * Every schema here builds its messages from a translator (`Translate`), but a
 * check written without one — `.positive()` on "Maximum uses", `.min(0)` on an
 * amount — falls back to zod's built-in wording, which is English unless zod
 * is told otherwise. This tells it. A message a schema does pass still wins:
 * the locale only fills in the checks that have none.
 */
const ZOD_LOCALES: Record<SupportedLocale, () => Parameters<typeof z.config>[0]> = {
  en,
  ar,
}

export function applyZodLocale(locale: string) {
  z.config(ZOD_LOCALES[resolveLocale(locale)]())
}

/**
 * Mounted once, inside the root layout's intl provider. An effect rather than
 * a render-time call: nothing validates before the first commit, and a locale
 * switch re-renders the tree, which runs this again.
 */
export function ZodLocale() {
  const locale = useLocale()
  useEffect(() => {
    applyZodLocale(locale)
  }, [locale])
  return null
}
