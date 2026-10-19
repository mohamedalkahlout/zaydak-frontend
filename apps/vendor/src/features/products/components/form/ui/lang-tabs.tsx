"use client"

import { createContext, useContext, useState } from "react"
import { useTranslations } from "next-intl"
import { LanguagesIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Field } from "@repo/ui/components/field"

export type Locale = "en" | "ar"

interface LocaleContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * Wraps the form so every `TranslatableInput` reads the same locale and a
 * single `LangTabsBar` switches them all at once. Scoping the value to
 * React context (rather than a Zustand store) keeps a hypothetical second
 * form on the same screen independent.
 */
export function LocaleProvider({
  children,
  defaultLocale = "en",
}: {
  children: React.ReactNode
  defaultLocale?: Locale
}) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useFormLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? "en"
}

/** Tiny rounded US flag — represents the EN locale. */
function FlagUS({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 12"
      aria-hidden
      className={cn("overflow-hidden rounded-[2px]", className)}
    >
      <rect width="16" height="12" fill="#B22234" />
      <rect y="1.85" width="16" height="0.92" fill="#fff" />
      <rect y="3.69" width="16" height="0.92" fill="#fff" />
      <rect y="5.54" width="16" height="0.92" fill="#fff" />
      <rect y="7.38" width="16" height="0.92" fill="#fff" />
      <rect y="9.23" width="16" height="0.92" fill="#fff" />
      <rect width="6.4" height="6.46" fill="#3C3B6E" />
    </svg>
  )
}

/** Tiny rounded Saudi-style flag — represents the AR locale. */
function FlagSA({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 12"
      aria-hidden
      className={cn("overflow-hidden rounded-[2px]", className)}
    >
      <rect width="16" height="12" fill="#006C35" />
      <path
        d="M3 4.5 Q5 3.2 8 4 Q11 4.8 13 4.2"
        stroke="#fff"
        strokeWidth="0.7"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="3" y="8" width="10" height="0.7" rx="0.35" fill="#fff" />
      <path
        d="M12 7.6 L13.2 8.35 L12 9.1 Z"
        fill="#fff"
      />
    </svg>
  )
}

const LOCALE_META: Record<
  Locale,
  {
    label: string
    Flag: (p: { className?: string }) => React.ReactElement
    activeRing: string
    activeText: string
    activeBg: string
  }
> = {
  en: {
    label: "EN",
    Flag: FlagUS,
    activeRing: "ring-blue-500/40",
    activeText: "text-blue-700 dark:text-blue-300",
    activeBg: "bg-blue-50 dark:bg-blue-950/40",
  },
  ar: {
    label: "AR",
    Flag: FlagSA,
    activeRing: "ring-emerald-500/40",
    activeText: "text-emerald-700 dark:text-emerald-300",
    activeBg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
}

/**
 * Floating pill pinned to the bottom-end of the viewport. Always visible
 * while the user scrolls the form so the connection between the switch
 * and the colored-bordered translatable fields stays obvious. Renders
 * nothing outside a `LocaleProvider` so it's safe to mount in shared
 * layout code.
 */
export function LangTabsBar({ className }: { className?: string }) {
  const ctx = useContext(LocaleContext)
  const t = useTranslations("products.formLang")
  if (!ctx) return null
  const { locale: current, setLocale } = ctx
  return (
    <div
      role="group"
      aria-label={t("aria")}
      className={cn(
        "fixed bottom-6 inset-e-6 z-40 flex items-center gap-2.5 rounded-full border bg-card px-3.5 py-1.5 shadow-lg",
        className,
      )}
    >
      <LanguagesIcon className="size-4 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">
        {t("editingIn")}
      </span>
      <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1 text-xs">
        {(["en", "ar"] as const).map((locale) => {
          const meta = LOCALE_META[locale]
          const active = current === locale
          const Flag = meta.Flag
          return (
            <button
              key={locale}
              type="button"
              onClick={() => setLocale(locale)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold uppercase transition",
                active
                  ? cn(
                      meta.activeBg,
                      meta.activeText,
                      "shadow-sm ring-1",
                      meta.activeRing,
                    )
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Flag className="size-3.5" />
              {meta.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Drop-in replacement for `<Field>` on rows containing a
 * `TranslatableInput`. Adds a locale-tinted left accent that mirrors the
 * floating switcher's active color — so users see at a glance which
 * fields the switcher is driving and which locale they're editing.
 */
export function TranslatableField({
  className,
  ...props
}: React.ComponentProps<typeof Field>) {
  const locale = useFormLocale()
  const accent =
    locale === "ar"
      ? "border-emerald-500/60"
      : "border-blue-500/60"
  return (
    <Field
      data-translatable
      className={cn(
        "border-s-[3px] ps-3.5 transition-colors",
        accent,
        className,
      )}
      {...props}
    />
  )
}
