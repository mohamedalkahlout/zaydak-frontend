"use client"

import { useTranslations } from "next-intl"
import { Minus, Plus } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

/**
 * A `− n +` control.
 *
 * `max` is nullable and an absent cap genuinely means uncapped — the vendor
 * either is not tracking quantity or accepts backorders, and in both cases only
 * the server may refuse. Substituting a made-up ceiling here would block a sale
 * the shop wanted.
 */
export function QuantityStepper({
  value,
  onChange,
  max,
  disabled,
  className,
}: {
  value: number
  onChange: (next: number) => void
  max?: number | null
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations("product")
  const tCommon = useTranslations("common")

  const atMax = typeof max === "number" && value >= max

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center overflow-hidden rounded-full bg-card ring-1 ring-shop-hairline",
        className,
      )}
      role="group"
      aria-label={t("quantity")}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-e-none"
        disabled={disabled || value <= 1}
        aria-label={tCommon("previous")}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus />
      </Button>
      <output
        className="w-10 text-center text-sm font-medium tabular-nums"
        aria-live="polite"
      >
        {value}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-s-none"
        disabled={disabled || atMax}
        aria-label={tCommon("next")}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
