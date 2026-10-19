"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { formatMoneyCents } from "@/shared/lib/format"
import { formatBucketLabel } from "@/features/analytics/lib/date-ranges"
import {
  trendChartPoints,
  trendHasData,
  type NegotiationTrendChartPoint,
} from "../lib/outcomes"
import type { NegotiationOutcomeRollups } from "../types"

// The sales chart's palette: brand teal for what made money, muted slate for
// the volume behind it. Grid and ticks are the theme tokens, as on the channel
// chart, so the hairlines stay one step off the card in dark mode too.
const SESSIONS_COLOR = "#94a3b8"
const REDEEMED_COLOR = "#0d9488"
const TICK = { fontSize: 11, fill: "var(--muted-foreground)" }
const GRID = "var(--border)"

/**
 * Negotiations per day (or month past 92 days) in the report's window: how
 * many started, and how many of those became orders that still stand. Two
 * bars side by side rather than stacked, because one is a subset of the other.
 *
 * Bucketed by the day the negotiation **started** — the report's own time
 * axis, which is what lets the buckets sum to the KPI row — and the hint says
 * so, since a deal redeemed days later counts on the day it was struck.
 */
export function NegotiationTrendCard({
  rollups,
  loading,
  failed,
}: {
  rollups: NegotiationOutcomeRollups | undefined
  loading: boolean
  failed: boolean
}) {
  const t = useTranslations("negotiationOutcomes")
  const locale = useLocale()
  const points = trendChartPoints(rollups?.trend ?? [])
  const granularity = rollups?.granularity ?? "day"
  const currency = rollups?.currency
  const label = (date: string) => formatBucketLabel(date, granularity, locale)
  const count = (n: number) => n.toLocaleString(locale)

  let body: ReactNode
  if (failed && !rollups) {
    body = (
      <p className="py-10 text-center text-sm text-destructive">
        {t("rollups.error")}
      </p>
    )
  } else if (loading && !rollups) {
    body = (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("loading")}
      </p>
    )
  } else if (!trendHasData(points)) {
    body = (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("trend.empty")}
      </p>
    )
  } else {
    body = (
      <>
        <div className="h-56" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              barCategoryGap="20%"
              barGap={2}
              margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={TICK}
                tickFormatter={label}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
                tick={TICK}
                tickFormatter={count}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={
                  <TrendTooltip
                    label={label}
                    count={count}
                    money={(cents) => formatMoneyCents(cents, currency, locale)}
                    labels={{
                      sessions: t("trend.sessions"),
                      accepted: t("trend.accepted"),
                      redeemed: t("trend.redeemed"),
                      revenue: t("trend.revenue"),
                      discount: t("trend.discount"),
                    }}
                  />
                }
              />
              <Bar
                dataKey="sessions"
                fill={SESSIONS_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
                isAnimationActive={false}
              />
              <Bar
                dataKey="redeemed"
                fill={REDEEMED_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* The chart's table twin, for screen readers: every value the
            tooltip shows, reachable without a pointer. `sr-only` sits on a
            wrapper, not the table: a table ignores the 1px width and would
            widen the page on a phone. */}
        <div className="sr-only">
          <table>
            <caption>{t("trend.table")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("trend.period")}</th>
                <th scope="col">{t("trend.sessions")}</th>
                <th scope="col">{t("trend.accepted")}</th>
                <th scope="col">{t("trend.redeemed")}</th>
                <th scope="col">{t("trend.revenue")}</th>
                <th scope="col">{t("trend.discount")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <th scope="row">{label(p.date)}</th>
                  <td>{count(p.sessions)}</td>
                  <td>{count(p.accepted)}</td>
                  <td>{count(p.redeemed)}</td>
                  <td>{formatMoneyCents(p.revenue_cents, currency, locale)}</td>
                  <td>{formatMoneyCents(p.discount_cents, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("trend.title")}</CardTitle>
            <CardDescription className="text-xs">
              {t("trend.hint")}
            </CardDescription>
          </div>
          {/* Legend: always beside the chart, one key per series, rect keys
              because the marks are bars. */}
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: SESSIONS_COLOR }}
                aria-hidden
              />
              {t("trend.sessions")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: REDEEMED_COLOR }}
                aria-hidden
              />
              {t("trend.redeemed")}
            </li>
          </ul>
        </div>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}

interface TrendTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: NegotiationTrendChartPoint }>
  label: (date: string) => string
  count: (n: number) => string
  money: (cents: number) => string
  labels: Record<
    "sessions" | "accepted" | "redeemed" | "revenue" | "discount",
    string
  >
}

/** Everything a bucket holds: the three counts, then its money. */
function TrendTooltip({
  active,
  payload,
  label,
  count,
  money,
  labels,
}: TrendTooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows: Array<[string, string]> = [
    [labels.sessions, count(point.sessions)],
    [labels.accepted, count(point.accepted)],
    [labels.redeemed, count(point.redeemed)],
  ]
  return (
    <div className="min-w-48 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{label(point.date)}</p>
      <ul className="flex flex-col gap-1">
        {rows.map(([name, value]) => (
          <li
            key={name}
            className="flex items-center justify-between gap-4 tabular-nums"
          >
            <span className="text-muted-foreground">{name}</span>
            <span className="font-medium text-foreground">{value}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-1.5 flex flex-col gap-1 border-t border-border pt-1.5">
        <li className="flex items-center justify-between gap-4 tabular-nums">
          <span className="text-muted-foreground">{labels.revenue}</span>
          <span className="font-medium text-foreground">
            {money(point.revenue_cents)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4 tabular-nums">
          <span className="text-muted-foreground">{labels.discount}</span>
          <span className="font-medium text-foreground">
            {money(point.discount_cents)}
          </span>
        </li>
      </ul>
    </div>
  )
}
