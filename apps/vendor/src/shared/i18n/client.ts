"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useLocale } from "next-intl"
import { setCookie } from "@/shared/lib/cookies"
import {
  LOCALE_COOKIE_NAME,
  type SupportedLocale,
  resolveLocale,
} from "./config"

/**
 * Persist the chosen locale to a cookie and ask Next to re-render the
 * current route so server components pick up the new language. The
 * Apollo locale link already reads the same cookie, so GraphQL
 * requests flip to the new `accept-language` on the next call.
 */
export function useChangeLocale() {
  const router = useRouter()
  const current = resolveLocale(useLocale())
  const [pending, startTransition] = useTransition()

  const change = (next: SupportedLocale) => {
    if (next === current) return
    setCookie(LOCALE_COOKIE_NAME, next, {
      // Persist for a year — long enough that users rarely re-pick,
      // short enough that abandoned browsers eventually get the
      // server's default locale back.
      maxAge: 60 * 60 * 24 * 365,
    })
    // `router.refresh` revalidates server components against the new
    // cookie; the transition keeps the UI responsive while it runs.
    startTransition(() => {
      router.refresh()
    })
  }

  return { locale: current, change, pending }
}
