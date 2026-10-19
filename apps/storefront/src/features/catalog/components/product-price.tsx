"use client"

import { useLocale, useTranslations } from "next-intl"

import { cn } from "@repo/ui/lib/utils"

import { discountPercent, formatMoney } from "@/shared/lib/format"
import { useCurrency } from "@/shared/lib/currency/use-currency"
import type { PriceDisplay } from "../lib/product"

/**
 * The one place a price is rendered.
 *
 * Every screen — tile, PDP, cart line, order row — goes through this, so the
 * sale colour, the strikethrough and the range separator are decided once. The
 * `currency` prop is required and nullable rather than defaulted: while the
 * shop query is still in flight there is no honest currency to print, so the
 * component renders a placeholder instead of a number in a guessed one.
 *
 * `tone` is where the price is standing:
 *
 *  - `default` — ink on paper, the sale price in the sale colour.
 *  - `inverse` — the product page's ink buy bar: paper on ink, flipping with
 *    the theme exactly as the bar does.
 *  - `photoBare` — the tile: white ink on the caption's scrim, laid over a
 *    photograph. It does **not** flip with the theme, because the photo under
 *    it does not either, and the sale colour is dropped here as it is in
 *    `inverse`.
 *
 * `photoBare` is **tight**: it shares the tile's last line with the add-to-cart
 * button, so it asks the formatter for the locale's shortest currency marker
 * and drops the strikethrough "was", which would otherwise take the room the
 * button needs for something the `-20%` badge on the picture already says. The
 * roomy tones keep both numbers. A price is never made shorter by hiding what
 * it costs, only by moving the second number somewhere it fits.
 */
type Tone = "default" | "inverse" | "photoBare"

const TONES: Record<
  Tone,
  {
    main: string
    sale: string
    was: string
    placeholder: string
    /** Shares its line with something else: narrow marker, no "was". */
    tight?: boolean
  }
> = {
  default: {
    main: "text-foreground",
    sale: "text-shop-sale",
    was: "text-muted-foreground",
    placeholder: "bg-muted",
  },
  inverse: {
    main: "text-background",
    sale: "text-background",
    was: "text-background/55",
    placeholder: "bg-background/20",
  },
  photoBare: {
    main: "text-shop-photo-ink",
    sale: "text-shop-photo-ink",
    was: "text-shop-photo-muted",
    placeholder: "bg-shop-photo-chip",
    tight: true,
  },
}

export function ProductPrice({
  price,
  currency,
  size = "md",
  tone = "default",
  className,
}: {
  price: PriceDisplay
  currency: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  tone?: Tone
  className?: string
}) {
  const locale = useLocale()
  const t = useTranslations("product")

  const scale = {
    xs: "text-[0.8125rem]",
    sm: "text-sm",
    md: "text-base",
    lg: "font-heading text-2xl",
    xl: "font-heading text-3xl sm:text-4xl",
  }[size]

  const look = TONES[tone]
  const { isConverted, formatDisplayPrice } = useCurrency()

  const money = (cents: number) => {
    if (isConverted) {
      return `~${formatDisplayPrice(cents, locale, { narrow: Boolean(look.tight) })}`
    }
    return formatMoney(cents, currency, locale, { narrow: Boolean(look.tight) })
  }

  const baseMoney = (cents: number) =>
    formatMoney(cents, currency, locale, { narrow: Boolean(look.tight) })

  if (!currency || price.kind === "unpriced") {
    return (
      <span
        className={cn("inline-block h-[1em] w-16 rounded", look.placeholder, className)}
        aria-hidden
      />
    )
  }

  if (price.kind === "range") {
    return (
      <span
        className={cn("font-semibold tabular-nums", scale, look.main, className)}
      >
        {t("from", { price: money(price.minCents) })}
      </span>
    )
  }

  const off = discountPercent(price.compareAtCents, price.sellingCents)

  return (
    <span
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
        className,
      )}
    >
      <span
        className={cn("font-semibold tabular-nums", scale, off ? look.sale : look.main)}
      >
        {money(price.sellingCents)}
      </span>
      {/*
        A tight tone carries one number and no "was": it shares the tile's last
        line with the add-to-cart button, and a second price takes the room
        that button needs for something the tile already says louder, on the
        `-20%` badge over the picture.
      */}
      {!look.tight && off !== null && price.compareAtCents !== null && (
        <span className={cn("text-xs line-through tabular-nums", look.was)}>
          {money(price.compareAtCents)}
        </span>
      )}
      {!look.tight && isConverted && (
        <span className={cn("text-[0.6875rem] text-muted-foreground tabular-nums", look.was)}>
          ({baseMoney(price.sellingCents)})
        </span>
      )}
    </span>
  )
}

/** The `-30%` chip. Renders nothing when there is no genuine markdown. */
export function SaleBadge({
  price,
  className,
}: {
  price: PriceDisplay
  className?: string
}) {
  const t = useTranslations("product")
  if (price.kind !== "single") return null

  const off = discountPercent(price.compareAtCents, price.sellingCents)
  if (off === null) return null

  return (
    <span
      className={cn(
        "rounded-full bg-shop-sale px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-white",
        className,
      )}
    >
      {t("salePercent", { percent: off })}
    </span>
  )
}
