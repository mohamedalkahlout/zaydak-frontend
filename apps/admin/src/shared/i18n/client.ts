"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useLocale } from "next-intl"

import { setCookie } from "@/shared/lib/cookies"
import { LOCALE_COOKIE_NAME, type SupportedLocale, resolveLocale } from "./config"

/**
 * Persist the chosen locale to a cookie and re-render the route so server
 * components pick up the new language.
 */
export function useChangeLocale() {
  const router = useRouter()
  const current = resolveLocale(useLocale())
  const [pending, startTransition] = useTransition()

  const change = (next: SupportedLocale) => {
    if (next === current) return
    setCookie(LOCALE_COOKIE_NAME, next, { maxAge: 60 * 60 * 24 * 365 })
    startTransition(() => {
      router.refresh()
    })
  }

  return { locale: current, change, pending }
}
