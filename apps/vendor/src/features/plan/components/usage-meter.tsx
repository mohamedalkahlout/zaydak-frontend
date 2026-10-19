"use client"

import { useTranslations } from "next-intl"
import { cn } from "@repo/ui/lib/utils"
import { percentUsed } from "../lib/entitlements"
import { formatQuantity, formatReset, unitLabel } from "../lib/format-unit"
import type { UsageEntry } from "../types"

/**
 * One metered capability's consumption.
 *
 * Renders from the row alone — the label, the unit and the reset date all come
 * from the server — so a capability added next month appears here with no
 * frontend change.
 */
export function UsageMeter({
  usage,
  label,
  locale = "en",
}: {
  usage: UsageEntry
  label: string
  locale?: string
}) {
  const t = useTranslations("plan")
  const limit = usage.limit_value ?? null
  const percent = percentUsed(limit, usage.used)
  const unlimited = limit === null
  const exhausted = !unlimited && (usage.remaining ?? 0) === 0
  const resets = formatReset(usage.period_end, locale)

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span
          className={cn(
            "shrink-0 tabular-nums",
            exhausted ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {unlimited ? (
            <>
              {formatQuantity(usage.used, usage.billing_unit, locale)}{" "}
              <span className="opacity-70">/ ∞</span>
            </>
          ) : (
            <>
              {formatQuantity(usage.used, usage.billing_unit, locale)} /{" "}
              {formatQuantity(limit, usage.billing_unit, locale)}{" "}
              {unitLabel(usage.billing_unit, limit, t)}
            </>
          )}
        </span>
      </div>

      {/*
        No bar for an unlimited allowance: a full-width track with nothing to
        fill reads as "at the limit", which is the opposite of the truth.
      */}
      {!unlimited && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              exhausted
                ? "bg-destructive"
                : (percent ?? 0) >= 80
                  ? "bg-amber-500"
                  : "bg-primary",
            )}
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
      )}

      {resets && !unlimited && (
        <p className="text-xs text-muted-foreground">
          {exhausted
            ? t("meter.noneLeft", { date: resets })
            : t("meter.resets", { date: resets })}
        </p>
      )}
    </div>
  )
}
