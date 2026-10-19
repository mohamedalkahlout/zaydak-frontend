"use client"

import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import type { SalesReport } from "../types"
import { formatBucketLabel } from "../lib/date-ranges"

// recharts can't consume Tailwind classes for SVG internals, so the series
// colours are concrete: brand teal for the current period, muted slate for
// the comparison line. The grid and ticks are the theme tokens, as on the
// channel chart: a fixed slate-200 grid glared on the dark card.
const CURRENT_COLOR = "#0d9488"
const PREVIOUS_COLOR = "#94a3b8"
const GRID_COLOR = "var(--border)"
const TICK_COLOR = "var(--muted-foreground)"

function compactMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    const k = value / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return `${value}`
}

export function SalesOverTimeCard({
  report,
  loading,
  compare,
  className,
  currency = "SAR",
}: {
  report: SalesReport | undefined
  loading?: boolean
  compare: boolean
  className?: string
  currency?: string
}) {
  const t = useTranslations("analytics")
  // The axis names its dates in the dashboard's language, not the browser's.
  const locale = useLocale()
  const granularity = report?.granularity ?? "day"

  const data = useMemo(() => {
    const series = report?.series ?? []
    const prev = report?.previous_series ?? []
    return series.map((point, i) => ({
      label: formatBucketLabel(point.date, granularity, locale),
      current: point.total_sales_cents / 100,
      previous: compare && prev[i] ? prev[i].total_sales_cents / 100 : null,
    }))
  }, [report, granularity, compare, locale])

  const total = report?.current.total_sales_cents

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle>{t("chart.title")}</CardTitle>
        <Bones
          name="analytics-sales-over-time-total"
          loading={loading || total == null}
          className="mt-1"
        >
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {formatMoneyCents(total, currency)}
          </p>
        </Bones>
      </CardHeader>
      <CardContent className="h-72 px-2">
        {/* `[&>[data-boneyard-content]]:h-full` — boneyard wraps children in an
            unstyled div, and `ResponsiveContainer`'s `height="100%"` measures
            its parent. Without this the chart collapses to zero height. */}
        <Bones
          name="analytics-sales-over-time-chart"
          loading={Boolean(loading) && !report}
          className="h-full w-full [&>[data-boneyard-content]]:h-full"
          snapshotConfig={{ leafTags: ["svg"] }}
        >
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsSalesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CURRENT_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CURRENT_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fontSize: 11, fill: TICK_COLOR }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={compactMoney}
                tick={{ fontSize: 11, fill: TICK_COLOR }}
              />
              <Tooltip
                cursor={{ stroke: GRID_COLOR }}
                content={
                  <SalesTooltip compare={compare} t={t} currency={currency} />
                }
              />
              {compare ? (
                <Area
                  type="monotone"
                  dataKey="previous"
                  stroke={PREVIOUS_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="current"
                stroke={CURRENT_COLOR}
                strokeWidth={2}
                fill="url(#analyticsSalesArea)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </Bones>
      </CardContent>
    </Card>
  )
}

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: Array<{ dataKey: string; value: number | null }>
  compare: boolean
  currency: string
  t: (key: string) => string
}

function SalesTooltip({
  active,
  label,
  payload,
  compare,
  currency,
  t,
}: TooltipProps) {
  if (!active || !payload?.length) return null
  const current = payload.find((p) => p.dataKey === "current")?.value ?? 0
  const previous = payload.find((p) => p.dataKey === "previous")?.value

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p className="flex items-center justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">{t("chart.current")}</span>
        <span className="font-medium">
          {formatMoneyCents(Math.round((current ?? 0) * 100), currency)}
        </span>
      </p>
      {compare && previous != null ? (
        <p className="flex items-center justify-between gap-4 tabular-nums">
          <span className="text-muted-foreground">{t("chart.previous")}</span>
          <span>{formatMoneyCents(Math.round(previous * 100), currency)}</span>
        </p>
      ) : null}
    </div>
  )
}
