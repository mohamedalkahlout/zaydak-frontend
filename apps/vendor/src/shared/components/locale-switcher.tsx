"use client"

import { LocaleSwitcher as UiLocaleSwitcher } from "@repo/ui/components/locale-switcher"
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/shared/i18n/config"
import { useChangeLocale } from "@/shared/i18n/client"

interface LocaleSwitcherProps {
  /** `icon` is a compact globe button, `labeled` shows the current locale name. */
  variant?: "icon" | "labeled"
  className?: string
}

/**
 * Locale picker backed by the `locale` cookie. Writes the cookie then triggers
 * `router.refresh()` so server components re-render in the chosen language.
 * Apollo's locale link reads the same cookie — so `accept-language` flips on the
 * next GraphQL call.
 */
export function LocaleSwitcher({ variant = "icon", className }: LocaleSwitcherProps) {
  const { locale, change, pending } = useChangeLocale()

  return (
    <UiLocaleSwitcher<SupportedLocale>
      locale={locale}
      locales={SUPPORTED_LOCALES}
      labels={LOCALE_LABELS}
      onChange={change}
      pending={pending}
      variant={variant}
      className={className}
    />
  )
}
