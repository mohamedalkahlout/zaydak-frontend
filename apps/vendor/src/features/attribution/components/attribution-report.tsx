"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { Bones } from "@/shared/components/bones"
import { formatMoney, formatMoneyCents } from "@/shared/lib/format"
import {
  rangeForPreset,
  RANGE_PRESETS,
  type RangePreset,
} from "@/features/analytics/lib/date-ranges"
import { ATTRIBUTION_REPORT } from "../api/queries"
import type {
  AttributionDimension,
  AttributionModel,
  AttributionReportResponse,
  AttributionRow,
} from "../types"
import {
  DIMENSION_OPTIONS,
  MODEL_OPTIONS,
  aovCents,
  cacCents,
  channelColor,
  hasNegativeRevenue,
  roasMultiple,
} from "../lib/attribution"

// recharts can't read Tailwind for SVG internals: the grid, ticks and hover
// band are the theme tokens, so they hold on the dark card too.
const GRID_COLOR = "var(--border)"
const TICK = { fontSize: 11, fill: "var(--muted-foreground)" }

function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    const k = value / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return `${value}`
}

export function AttributionReport() {
  const t = useTranslations("attribution")
  const tAnalytics = useTranslations("analytics")
  const locale = useLocale()

  const [groupBy, setGroupBy] = useState<AttributionDimension>("CHANNEL")
  const [model, setModel] = useState<AttributionModel>("LAST_TOUCH")
  const [preset, setPreset] = useState<RangePreset>("last_30_days")

  const window = useMemo(() => {
    const range = rangeForPreset(preset)
    return { start: range.start.toISOString(), end: range.end.toISOString() }
  }, [preset])

  const { data, loading } = useQuery<AttributionReportResponse>(
    ATTRIBUTION_REPORT,
    {
      variables: { input: { start: window.start, end: window.end, groupBy, model } },
      fetchPolicy: "cache-and-network",
    },
  )

  const params = useParams<{ shopSlug: string }>()
  const adSpendHref = `/store/${params?.shopSlug ?? ""}/analytics/attribution/ad-spend`

  const report = data?.attributionReport?.data
  const rows = report?.rows ?? []
  const currency = report?.currency ?? "SAR"

  const rowLabel = (row: AttributionRow): string => {
    if (row.key === "(none)") return t("none")
    return groupBy === "CHANNEL" ? t(`channels.${row.key}`) : row.key
  }

  // A group can end the window at zero or below (refunds settled in it for
  // orders placed earlier), so every ratio goes through a helper that answers
  // null where there is no honest figure; null prints as an em dash.
  const multiple = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const roas = (row: AttributionRow): string => {
    const value = roasMultiple(row)
    return value == null ? "—" : `${multiple.format(value)}x`
  }
  const cac = (row: AttributionRow): string =>
    formatMoneyCents(cacCents(row), currency)
  const aov = (row: AttributionRow): string =>
    formatMoneyCents(aovCents(row), currency)
  const totals = report?.totals
  const showsNegative = hasNegativeRevenue(totals ? [...rows, totals] : rows)

  // Negative groups draw below the zero line; recharts rounds the data end of
  // a negative bar too, so the radius needs no special case.
  const chartData = rows.slice(0, 12).map((r) => ({
    label: rowLabel(r),
    revenue: r.revenue_cents / 100,
    color: channelColor(r.channel),
  }))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={adSpendHref} />}
          >
            {t("manageAdSpend")}
          </Button>
          <Select
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as AttributionDimension)}
          >
            <SelectTrigger className="w-36">
              <SelectValue>
                {(value: AttributionDimension | null) =>
                  value ? t(`dimensions.${value}`) : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DIMENSION_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(`dimensions.${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={model}
            onValueChange={(v) => setModel(v as AttributionModel)}
          >
            <SelectTrigger className="w-36">
              <SelectValue>
                {(value: AttributionModel | null) =>
                  value ? t(`models.${value}`) : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`models.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value: RangePreset | null) =>
                  value ? tAnalytics(`ranges.${value}`) : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tAnalytics(`ranges.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t("revenueByGroup")}</CardTitle>
        </CardHeader>
        <CardContent className="h-64 px-2">
          {/* leafTags svg + the h-full on boneyard's content wrapper — see
              analytics/sales-over-time-card for why both are needed. */}
          <Bones
            name="attribution-revenue-chart"
            loading={Boolean(loading) && !report}
            className="h-full w-full [&>[data-boneyard-content]]:h-full"
            snapshotConfig={{ leafTags: ["svg"] }}
          >
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {tAnalytics("empty")}
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={8}
                  tick={TICK}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={compact}
                  tick={TICK}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                  formatter={(value) =>
                    [formatMoney(Number(value), currency), t("revenue")] as [
                      string,
                      string,
                    ]
                  }
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </Bones>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t("breakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Bones
            name="attribution-breakdown"
            loading={Boolean(loading) && !report}
          >
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {tAnalytics("empty")}
              </p>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(`dimensions.${groupBy}`)}</TableHead>
                    <TableHead className="text-end">{t("revenue")}</TableHead>
                    <TableHead className="text-end">{t("orders")}</TableHead>
                    <TableHead className="text-end">{t("aov")}</TableHead>
                    <TableHead className="text-end">{t("newCustomers")}</TableHead>
                    <TableHead className="text-end">{t("returningCustomers")}</TableHead>
                    <TableHead className="text-end">{t("cac")}</TableHead>
                    <TableHead className="text-end">{t("roas")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: channelColor(row.channel) }}
                        />
                        {rowLabel(row)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMoneyCents(row.revenue_cents, currency)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {row.orders.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {aov(row)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {row.new_customers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {row.returning_customers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {cac(row)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {roas(row)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">{t("total")}</TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {formatMoneyCents(totals?.revenue_cents, currency)}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {(totals?.orders ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {totals ? aov(totals) : "—"}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {(totals?.new_customers ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {(totals?.returning_customers ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {totals ? cac(totals) : "—"}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {totals ? roas(totals) : "—"}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">{t("cacHint")}</p>
              {showsNegative ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("negativeHint")}
                </p>
              ) : null}
              </>
            )}
          </Bones>
        </CardContent>
      </Card>
    </div>
  )
}
