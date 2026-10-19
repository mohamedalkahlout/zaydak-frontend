"use client"

import { useLocale, useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Bones } from "@/shared/components/bones"
import type { MonthlyRevenue } from "../types"
import { barShare, formatCompactCents, monthLabels } from "../lib/analytics"
import { formatAmountCents } from "@/shared/lib/format"
import { AnalyticsPanel } from "./panel"

/**
 * Platform revenue per month, for one year.
 *
 * **Deliberately not a charting library.** The admin console ships no recharts
 * (the vendor dashboard's ~500KB of it is the only reason it is in the repo at
 * all), and twelve labelled bars do not justify adding it here. These are CSS
 * bars over the `yearlySales` series, which always returns all twelve months —
 * zero-revenue months included — so the axis never shifts between years.
 *
 * `total_cents` arrives as integer cents. Nothing here divides by 100 — the
 * two formatters do it.
 */
export function RevenueByMonthCard({
  months,
  year,
  years,
  onYearChange,
  loading,
}: {
  months: readonly MonthlyRevenue[]
  year: number
  years: readonly number[]
  onYearChange: (year: number) => void
  loading: boolean
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()
  const labels = monthLabels(locale)
  const max = months.reduce((m, row) => Math.max(m, row.total_cents), 0)
  const yearTotal = months.reduce((sum, row) => sum + row.total_cents, 0)

  return (
    <AnalyticsPanel
      title={t("revenueByMonth.title")}
      description={t("revenueByMonth.subtitle", {
        total: formatAmountCents(yearTotal, locale),
      })}
      action={
        <Select
          value={String(year)}
          // Same guard as the window picker: `Number(null)` is 0, which would
          // ask the server for year 0 rather than keep the current selection.
          onValueChange={(value) => {
            if (value) onYearChange(Number(value))
          }}
        >
          <SelectTrigger className="w-28" aria-label={t("revenueByMonth.year")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Bones name="admin-revenue-by-month" loading={loading}>
        <div className="flex flex-col gap-2">
          {max <= 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("revenueByMonth.empty", { year })}
            </p>
          ) : (
            months.map((row) => (
              <div key={row.month} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-xs text-muted-foreground">
                  {labels[row.month - 1]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${barShare(row.total_cents, max)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-end text-xs tabular-nums">
                  {formatCompactCents(row.total_cents, locale)}
                </span>
              </div>
            ))
          )}
        </div>
      </Bones>
    </AnalyticsPanel>
  )
}
