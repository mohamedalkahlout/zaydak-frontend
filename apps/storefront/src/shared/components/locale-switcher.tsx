"use client"

import { LocaleSwitcher as UiLocaleSwitcher } from "@repo/ui/components/locale-switcher"
import { cn } from "@repo/ui/lib/utils"
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/shared/i18n/config"
import { useChangeLocale } from "@/shared/i18n/client"

interface LocaleSwitcherProps {
  variant?: "icon" | "labeled"
  className?: string
}

/** Locale picker backed by the `locale` cookie. */
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

/**
 * The same choice as a **segmented control** rather than a menu.
 *
 * `LocaleSwitcher` above is a dropdown, and a dropdown is the wrong shape for
 * the two places this one is used — inside the account menu and inside the
 * notch panel. Both are already popups, so a menu there is a menu inside a
 * menu: base-ui needs `Menu.Sub` for that, and a two-item language choice does
 * not earn a submenu. The vendor dashboard hit the same wall and answered it
 * with a dialog, which is one more surface and two more clicks.
 *
 * A segmented control is strictly better at this size. Both languages are on
 * screen, so there is nothing to open to discover what the alternative is, and
 * switching costs one press instead of three. It is also the one control here
 * that must read correctly in a script it is not currently rendering, which is
 * why each segment carries its own `lang`: the browser then picks the Arabic
 * face for العربية even while the interface is English, and a screen reader
 * pronounces it as Arabic rather than spelling it out in English phonemes.
 *
 * It generalises past two locales — the thumb is `100% / n` wide and slides by
 * whole multiples of itself — so adding a third does not silently break the
 * geometry into a control whose highlight sits over the wrong word.
 */
export function LocaleSegmented({
  label,
  className,
}: {
  /** Already-localized "Language", used as the group's accessible name. */
  label: string
  className?: string
}) {
  const { locale, change, pending } = useChangeLocale()
  const activeIndex = SUPPORTED_LOCALES.indexOf(locale)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        // The track is a wash of the page ink rather than a named surface
        // colour, so the one control reads correctly on both of its grounds:
        // the popover (white / #1c1815) and the notch panel (white / #080706).
        "relative grid gap-0 rounded-full bg-foreground/[0.06] p-1 ring-1 ring-foreground/10",
        // Which way the thumb travels. A `transform` is not direction-aware —
        // `translateX` is rightward in both scripts — so RTL is flipped here
        // once rather than in the two places the offset is computed.
        "[--seg-dir:1] rtl:[--seg-dir:-1]",
        pending && "opacity-60",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${SUPPORTED_LOCALES.length}, minmax(0, 1fr))`,
      }}
    >
      {/*
        One moving element under all the labels, rather than a background that
        turns on and off per segment. Only a single element that travels reads
        as *the same* selection moving; per-segment fills read as two unrelated
        things blinking, and cross-fade at this size looks like a repaint.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 start-1 rounded-full bg-foreground shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${SUPPORTED_LOCALES.length})`,
          transform: `translateX(calc(var(--seg-dir) * ${activeIndex} * 100%))`,
        }}
      />

      {SUPPORTED_LOCALES.map((code) => {
        const isActive = code === locale
        return (
          <button
            key={code}
            type="button"
            role="radio"
            lang={code}
            aria-checked={isActive}
            disabled={pending}
            // The menu this sits in must stay open. A language switch re-renders
            // the surrounding chrome, and watching the menu you are standing in
            // flip script is the confirmation that the press worked — closing it
            // throws that away and leaves the shopper checking the page behind.
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              change(code)
            }}
            className={cn(
              "relative z-10 cursor-pointer rounded-full px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap outline-none transition-colors duration-300",
              "focus-visible:ring-2 focus-visible:ring-foreground/40",
              isActive
                ? "text-background"
                : "text-muted-foreground hover:text-foreground",
              pending && "cursor-not-allowed",
            )}
          >
            {LOCALE_LABELS[code]}
          </button>
        )
      })}
    </div>
  )
}
