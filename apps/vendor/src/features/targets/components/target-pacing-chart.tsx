"use client"

import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMoney } from "@/shared/lib/format"
import { formatBucketLabel } from "@/features/analytics/lib/date-ranges"
import type { PacePoint, TargetUnit } from "../types"

// Same palette as the analytics chart: actual = brand teal, the ideal
// (linear-to-target) reference = muted slate dashed, theme-token grid and
// ticks so the hairlines hold on the dark card.
const ACTUAL_COLOR = "#0d9488"
const IDEAL_COLOR = "#94a3b8"
const GRID_COLOR = "var(--border)"
const TICK_COLOR = "var(--muted-foreground)"

/** Wire integer → chart display number for a unit (cents→major, bps→percent). */
function toDisplay(value: number, unit: TargetUnit): number {
  if (unit === "money") return value / 100
  if (unit === "rate") return value / 100
  return value
}

function formatDisplay(value: number, unit: TargetUnit, currency: string): string {
  if (unit === "money") return formatMoney(value, currency)
  if (unit === "rate") return `${value.toFixed(1)}%`
  return value.toLocaleString()
}

function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    const k = value / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return `${value}`
}

export function TargetPacingChart({
  pacingSeries,
  idealPaceSeries,
  unit,
  currency,
  granularity = "day",
}: {
  pacingSeries: PacePoint[]
  idealPaceSeries: PacePoint[]
  unit: TargetUnit
  currency: string
  granularity?: string
}) {
  const t = useTranslations("targets")
  // Dates on the axis follow the dashboard language, not the browser's.
  const locale = useLocale()

  const data = useMemo(
    () =>
      pacingSeries.map((p, i) => ({
        label: formatBucketLabel(p.date, granularity, locale),
        actual: toDisplay(p.value, unit),
        ideal: toDisplay(idealPaceSeries[i]?.value ?? 0, unit),
      })),
    [pacingSeries, idealPaceSeries, unit, granularity, locale],
  )

  if (data.length === 0) return null

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tick={{ fontSize: 10, fill: TICK_COLOR }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={compact}
            tick={{ fontSize: 10, fill: TICK_COLOR }}
          />
          <Tooltip
            cursor={{ stroke: GRID_COLOR }}
            content={
              <PacingTooltip unit={unit} currency={currency} t={t} />
            }
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke={IDEAL_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={ACTUAL_COLOR}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: Array<{ dataKey: string; value: number | null }>
  unit: TargetUnit
  currency: string
  t: (key: string) => string
}

function PacingTooltip({
  active,
  label,
  payload,
  unit,
  currency,
  t,
}: TooltipProps) {
  if (!active || !payload?.length) return null
  const actual = payload.find((p) => p.dataKey === "actual")?.value ?? 0
  const ideal = payload.find((p) => p.dataKey === "ideal")?.value ?? 0
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p className="flex items-center justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">{t("pacing.actual")}</span>
        <span className="font-medium">
          {formatDisplay(actual ?? 0, unit, currency)}
        </span>
      </p>
      <p className="flex items-center justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">{t("pacing.ideal")}</span>
        <span>{formatDisplay(ideal ?? 0, unit, currency)}</span>
      </p>
    </div>
  )
}
