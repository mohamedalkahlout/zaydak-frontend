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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import type { SalesReport } from "../types"
import { formatBucketLabel } from "../lib/date-ranges"

// Same palette as SalesOverTimeCard (recharts can't read Tailwind): concrete
// series colours, theme-token grid and ticks.
const CURRENT_COLOR = "#0d9488"
const PREVIOUS_COLOR = "#94a3b8"
const GRID_COLOR = "var(--border)"
const TICK_COLOR = "var(--muted-foreground)"

/** Per-bucket AOV from the additive series; null for zero-order buckets. */
function bucketAov(totalCents: number, orders: number): number | null {
  return orders > 0 ? totalCents / orders / 100 : null
}

export function AovOverTimeCard({
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
  const locale = useLocale()
  const granularity = report?.granularity ?? "day"

  const data = useMemo(() => {
    const series = report?.series ?? []
    const prev = report?.previous_series ?? []
    return series.map((point, i) => ({
      label: formatBucketLabel(point.date, granularity, locale),
      current: bucketAov(point.total_sales_cents, point.orders_count),
      previous:
        compare && prev[i]
          ? bucketAov(prev[i].total_sales_cents, prev[i].orders_count)
          : null,
    }))
  }, [report, granularity, compare, locale])

  const aov = report?.current.average_order_value_cents
  // Buckets are pre-seeded server-side, so a dead window is a non-empty
  // series of all-null AOVs — treat that as "no data", not a blank plane.
  const hasPoints = data.some((p) => p.current != null || p.previous != null)

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle>{t("aovChart.title")}</CardTitle>
        <Bones
          name="analytics-aov-total"
          loading={loading || aov == null}
          className="mt-1"
        >
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {formatMoneyCents(aov, currency)}
          </p>
        </Bones>
      </CardHeader>
      <CardContent className="h-48 px-2">
        {/* See sales-over-time-card for why the content wrapper needs h-full. */}
        <Bones
          name="analytics-aov-chart"
          loading={Boolean(loading) && !report}
          className="h-full w-full [&>[data-boneyard-content]]:h-full"
          snapshotConfig={{ leafTags: ["svg"] }}
        >
          {data.length === 0 || !hasPoints ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke={GRID_COLOR}
                strokeDasharray="3 3"
              />
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
                tick={{ fontSize: 11, fill: TICK_COLOR }}
              />
              <Tooltip
                cursor={{ stroke: GRID_COLOR }}
                content={<AovTooltip compare={compare} t={t} currency={currency} />}
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
                fill="none"
                dot={false}
                isAnimationActive={false}
                connectNulls
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

function AovTooltip({ active, label, payload, compare, currency, t }: TooltipProps) {
  if (!active || !payload?.length) return null
  const current = payload.find((p) => p.dataKey === "current")?.value
  const previous = payload.find((p) => p.dataKey === "previous")?.value

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p className="flex items-center justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">{t("chart.current")}</span>
        <span className="font-medium">
          {current != null
            ? formatMoneyCents(Math.round(current * 100), currency)
            : "—"}
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
