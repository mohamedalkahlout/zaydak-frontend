"use client"

import { useLocale, useTranslations } from "next-intl"
import { Check, Minus } from "lucide-react"
import { formatQuantity, unitLabel } from "../lib/format-unit"
import type { CellValue } from "../lib/comparison"
import type { CapabilityEntry } from "../types"

/**
 * How one plan's answer for one capability reads.
 *
 * Returns null for the two states that are drawn rather than written — a tick
 * for included, a dash for excluded — so a caller that only wants words (the
 * plan cards' bullets) can skip them without re-deriving the rule.
 */
export function useCellLabel() {
  const locale = useLocale()
  const t = useTranslations("plan")

  return (cell: CellValue, capability: CapabilityEntry): string | null => {
    switch (cell.kind) {
      case "unlimited":
        return t("unlimited")
      case "amount": {
        const unit = capability.billing_unit
        const amount = formatQuantity(cell.value, unit, locale)
        const suffix = unitLabel(unit, cell.value, t)
        return suffix ? `${amount} ${suffix}` : amount
      }
      default:
        return null
    }
  }
}

/**
 * One cell of the comparison table.
 *
 * The dash is not styled as an error: a tier not selling a capability is a
 * normal answer, and colouring it red would read as something being broken.
 */
export function ComparisonCell({
  cell,
  capability,
}: {
  cell: CellValue
  capability: CapabilityEntry
}) {
  const label = useCellLabel()
  const t = useTranslations("plan")
  const text = label(cell, capability)

  if (cell.kind === "excluded") {
    return (
      <>
        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-hidden />
        <span className="sr-only">{t("notIncluded")}</span>
      </>
    )
  }

  if (cell.kind === "included") {
    return (
      <>
        <Check
          className="mx-auto size-4 text-emerald-600 dark:text-emerald-500"
          aria-hidden
        />
        <span className="sr-only">{t("included")}</span>
      </>
    )
  }

  return <span className="tabular-nums">{text}</span>
}
