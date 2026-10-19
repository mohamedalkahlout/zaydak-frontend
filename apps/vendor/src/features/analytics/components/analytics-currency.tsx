"use client"

import { ArrowRightLeftIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@repo/ui/components/popover"

/** The currency symbol for a code in the active locale, e.g. "SAR" → "﷼". */
function currencySymbol(currency: string, locale: string): string {
  try {
    const part = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")
    return part?.value ?? currency
  } catch {
    return currency
  }
}

/**
 * Report-currency chip. Reports are always denominated in the store's own
 * currency (the order snapshots carry it), so this is a display-only control —
 * clicking it just explains that. Shaped like the other filter buttons for
 * visual parity with Shopify's currency selector.
 */
export function AnalyticsCurrency({ currency }: { currency: string }) {
  const t = useTranslations("analytics")
  const locale = useLocale()
  const symbol = currencySymbol(currency, locale)

  return (
    <Popover>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            aria-label={t("currency.aria")}
          >
            <ArrowRightLeftIcon className="size-4 text-muted-foreground" />
            <span className="tabular-nums">{currency}</span>
            {symbol !== currency ? (
              <span className="text-muted-foreground">{symbol}</span>
            ) : null}
          </Button>
        )}
      />
      <PopoverContent
        align="start"
        aria-label={t("currency.aria")}
        className="w-64"
      >
        <PopoverDescription>{t("currency.hint")}</PopoverDescription>
      </PopoverContent>
    </Popover>
  )
}
