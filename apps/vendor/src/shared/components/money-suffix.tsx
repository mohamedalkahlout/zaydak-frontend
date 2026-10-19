"use client"

import { useLocale } from "next-intl"

import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { currencySuffix } from "@/shared/lib/format"

const AFFIX =
  "pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 font-medium text-muted-foreground"

/** The shop's currency mark in the dashboard's language ("SAR" → "ر.س" in Arabic). */
export function useCurrencyMark(): string {
  const currency = useShopCurrency()
  const locale = useLocale()
  return currencySuffix(currency, locale)
}

export function MoneySuffix({
  className = "text-xs",
}: {
  className?: string
}) {
  const mark = useCurrencyMark()
  return <span className={`${AFFIX} ${className}`}>{mark}</span>
}

/** A percent sign, or the shop currency mark, in the same end-side slot. */
export function MoneyOrPercentSuffix({
  percent,
  className = "text-[11px]",
}: {
  percent: boolean
  className?: string
}) {
  const mark = useCurrencyMark()
  return <span className={`${AFFIX} ${className}`}>{percent ? "%" : mark}</span>
}
