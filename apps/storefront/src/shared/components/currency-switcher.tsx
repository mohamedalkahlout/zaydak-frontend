"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Check, ChevronDown, Coins } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@repo/ui/lib/utils"
import { useCurrency } from "@/shared/lib/currency/use-currency"
import {
  MULTI_CURRENCY_ENABLED,
  type CurrencyPreset,
} from "@/shared/lib/currency/currency-presets"

interface CurrencySwitcherProps {
  /**
   * - `dropdown`: Labelled button with flag + code + symbol, opens popover.
   * - `compact`: Minimal trigger chip suitable for notch drawer and account menu.
   */
  variant?: "dropdown" | "compact"
  align?: "start" | "end" | "center"
  className?: string
}

/**
 * The one gate for shopper-facing currency selection.
 *
 * While `MULTI_CURRENCY_ENABLED` is off the control is absent from the tree
 * entirely — not hidden with CSS, and not an empty popover — so no call site
 * can leak one and the popover's state is never mounted. Call sites still guard
 * their own padded wrappers; this guard is what makes a missed one harmless.
 */
export function CurrencySwitcher(props: CurrencySwitcherProps) {
  if (!MULTI_CURRENCY_ENABLED) return null

  return <CurrencySwitcherControl {...props} />
}

function CurrencySwitcherControl({
  variant = "dropdown",
  align = "start",
  className,
}: CurrencySwitcherProps) {
  const [open, setOpen] = useState(false)
  const locale = useLocale()
  const t = useTranslations("common")
  const {
    displayCurrency,
    baseCurrency,
    setDisplayCurrency,
    supportedCurrencies,
    preset,
  } = useCurrency()

  const isAr = locale.startsWith("ar")

  const handleSelect = (code: string) => {
    setDisplayCurrency(code)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("displayCurrency")}
            className={cn(
              "h-8 gap-1.5 font-normal transition-colors",
              variant === "dropdown" &&
                "rounded-md border border-shop-footer-rule bg-shop-footer-field px-2.5 text-xs text-shop-footer-ink hover:bg-shop-footer-field/80",
              variant === "compact" &&
                "w-full justify-between rounded-xl px-3 py-2 text-start text-sm text-shop-notch-muted hover:bg-shop-notch-pill/60 hover:text-shop-notch-ink",
              className,
            )}
          >
            <span className="flex items-center gap-1.5 truncate">
              {variant === "compact" ? (
                <>
                  <Coins className="size-3.5 shrink-0 text-shop-notch-muted" />
                  <span className="truncate">{t("displayCurrency")}</span>
                </>
              ) : (
                <>
                  <span aria-hidden className="text-sm">
                    {preset.flag}
                  </span>
                  <span className="font-medium uppercase tracking-wider">
                    {preset.code}
                  </span>
                  <span className="text-muted-foreground">
                    ({isAr ? preset.symbolAr : preset.symbol})
                  </span>
                </>
              )}
            </span>

            <span className="flex items-center gap-1">
              {variant === "compact" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-shop-notch-ink">
                  <span aria-hidden>{preset.flag}</span>
                  <span>{preset.code}</span>
                </span>
              )}
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-200",
                  open && "rotate-180",
                  variant === "compact"
                    ? "text-shop-notch-muted"
                    : "text-muted-foreground",
                )}
              />
            </span>
          </Button>
        )}
      />

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-56 p-1 text-popover-foreground shadow-lg"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {t("displayCurrency")}
        </div>

        <div
          role="radiogroup"
          aria-label={t("displayCurrency")}
          className="max-h-60 overflow-y-auto"
        >
          {supportedCurrencies.map((c: CurrencyPreset) => {
            const active = c.code === displayCurrency
            const isBase = c.code === baseCurrency
            const name = isAr ? c.nameAr : c.nameEn
            const symbol = isAr ? c.symbolAr : c.symbol

            return (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleSelect(c.code)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-xs transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "hover:bg-muted/70",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="text-sm">
                    {c.flag}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold uppercase tracking-wide">
                        {c.code}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {symbol}
                      </span>
                      {isBase && (
                        <span className="rounded bg-muted px-1 py-0.2 text-[0.625rem] text-muted-foreground">
                          {isAr ? "المتجر" : "Store"}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[0.6875rem] text-muted-foreground">
                      {name}
                    </p>
                  </div>
                </div>

                {active && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
