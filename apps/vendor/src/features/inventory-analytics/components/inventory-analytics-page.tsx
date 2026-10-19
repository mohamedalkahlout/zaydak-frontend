"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
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
import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format"
import { MetricCard } from "@/features/analytics/components/metric-card"
import {
  rangeForPreset,
  RANGE_PRESETS,
  type RangePreset,
} from "@/features/analytics/lib/date-ranges"
import { INVENTORY_ANALYTICS } from "../api/queries"
import type { InventoryAnalyticsResponse } from "../types"
import { StockTable } from "./stock-table"

const ABC_COLORS: Record<string, string> = {
  A: "#059669",
  B: "#d97706",
  C: "#94a3b8",
}

export function InventoryAnalyticsPage() {
  const t = useTranslations("inventoryAnalytics")
  const tAnalytics = useTranslations("analytics")
  const [preset, setPreset] = useState<RangePreset>("last_30_days")

  const window = useMemo(() => {
    const range = rangeForPreset(preset)
    return { start: range.start.toISOString(), end: range.end.toISOString() }
  }, [preset])

  const { data, loading } = useQuery<InventoryAnalyticsResponse>(
    INVENTORY_ANALYTICS,
    {
      variables: {
        input: {
          start: window.start,
          end: window.end,
          lowStockThreshold: 10,
          limit: 10,
        },
      },
      fetchPolicy: "cache-and-network",
    },
  )

  const report = data?.inventoryAnalytics?.data
  const s = report?.summary
  const abc = report?.abc
  const currency = report?.currency ?? "SAR"
  const loadingFirst = loading && !report

  const abcTotal =
    (abc?.a_revenue_cents ?? 0) +
    (abc?.b_revenue_cents ?? 0) +
    (abc?.c_revenue_cents ?? 0)
  const abcRows = abc
    ? [
        { cls: "A", count: abc.a_count, revenue: abc.a_revenue_cents },
        { cls: "B", count: abc.b_count, revenue: abc.b_revenue_cents },
        { cls: "C", count: abc.c_count, revenue: abc.c_revenue_cents },
      ]
    : []

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_PRESETS.map((option) => (
              <SelectItem key={option} value={option}>
                {tAnalytics(`ranges.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("kpi.inventoryValue")}
          value={formatMoneyCents(s?.inventory_cost_cents, currency)}
          loading={loadingFirst}
          hint={t("kpi.atCost")}
        />
        <MetricCard
          label={t("kpi.retailValue")}
          value={formatMoneyCents(s?.inventory_retail_cents, currency)}
          loading={loadingFirst}
          hint={t("kpi.atRetail")}
        />
        <MetricCard
          label={t("kpi.totalUnits")}
          value={(s?.total_units ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.onHand", { count: s?.total_products ?? 0 })}
        />
        <MetricCard
          label={t("kpi.sellThrough")}
          value={`${bpsToPercent(s?.sell_through_bps).toFixed(0)}%`}
          loading={loadingFirst}
          hint={t("kpi.window")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("kpi.unitsSold")}
          value={(s?.units_sold_window ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.window")}
        />
        <MetricCard
          label={t("kpi.outOfStock")}
          value={(s?.out_of_stock ?? 0).toLocaleString()}
          loading={loadingFirst}
        />
        <MetricCard
          label={t("kpi.lowStock")}
          value={(s?.low_stock ?? 0).toLocaleString()}
          loading={loadingFirst}
        />
        <MetricCard
          label={t("kpi.deadStock")}
          value={(s?.dead_stock_count ?? 0).toLocaleString()}
          loading={loadingFirst}
        />
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t("abc.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("abc.subtitle")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {abcRows.map((row) => {
            const share = abcTotal > 0 ? (row.revenue / abcTotal) * 100 : 0
            return (
              <div key={row.cls} className="flex items-center gap-3">
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
                  style={{ backgroundColor: ABC_COLORS[row.cls] }}
                >
                  {row.cls}
                </span>
                <span className="w-28 shrink-0 text-sm text-muted-foreground">
                  {t("abc.count", { count: row.count })}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${share}%`,
                      backgroundColor: ABC_COLORS[row.cls],
                    }}
                  />
                </div>
                <span className="w-28 shrink-0 text-end text-sm tabular-nums">
                  {formatMoneyCents(row.revenue, currency)}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <StockTable
        title={t("tables.topMovers")}
        rows={report?.top_movers ?? []}
        currency={currency}
        loading={loadingFirst}
        emptyLabel={t("tables.empty")}
      />
      <StockTable
        title={t("tables.deadStock")}
        rows={report?.dead_stock ?? []}
        currency={currency}
        loading={loadingFirst}
        emptyLabel={t("tables.emptyDead")}
      />
      <StockTable
        title={t("tables.slowMovers")}
        rows={report?.slow_movers ?? []}
        currency={currency}
        loading={loadingFirst}
        emptyLabel={t("tables.empty")}
      />
    </div>
  )
}
