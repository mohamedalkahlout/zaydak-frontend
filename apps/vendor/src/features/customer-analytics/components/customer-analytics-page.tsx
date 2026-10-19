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
import { Bones } from "@/shared/components/bones"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format"
import { MetricCard } from "@/features/analytics/components/metric-card"
import {
  rangeForPreset,
  RANGE_PRESETS,
  type RangePreset,
} from "@/features/analytics/lib/date-ranges"
import { CUSTOMER_ANALYTICS } from "../api/queries"
import type { CustomerAnalyticsResponse } from "../types"
import { cohortCellStyle } from "../lib/cohort"

export function CustomerAnalyticsPage() {
  const t = useTranslations("customerAnalytics")
  const tAnalytics = useTranslations("analytics")
  const [preset, setPreset] = useState<RangePreset>("last_30_days")

  const window = useMemo(() => {
    const range = rangeForPreset(preset)
    return { start: range.start.toISOString(), end: range.end.toISOString() }
  }, [preset])

  const { data, loading } = useQuery<CustomerAnalyticsResponse>(
    CUSTOMER_ANALYTICS,
    {
      variables: {
        input: {
          start: window.start,
          end: window.end,
          cohortMonths: 12,
          topLimit: 10,
        },
      },
      fetchPolicy: "cache-and-network",
    },
  )

  const report = data?.customerAnalytics?.data
  const s = report?.summary
  const currency = report?.currency ?? "SAR"
  const loadingFirst = loading && !report

  // Column count = the longest cohort (oldest, index 0). Rows newest-first.
  const cohorts = report?.cohorts ?? []
  const maxPeriods = cohorts.reduce(
    (m, c) => Math.max(m, c.retention_bps.length),
    0,
  )
  const cohortRows = [...cohorts].reverse()

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
          <SelectTrigger className="w-44">
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
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("kpi.totalCustomers")}
          value={(s?.total_customers ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.lifetime")}
        />
        <MetricCard
          label={t("kpi.repeatRate")}
          value={`${bpsToPercent(s?.repeat_rate_bps).toFixed(1)}%`}
          loading={loadingFirst}
          hint={t("kpi.repeatHint", { count: s?.repeat_customers ?? 0 })}
        />
        <MetricCard
          label={t("kpi.avgLtv")}
          value={formatMoneyCents(s?.avg_ltv_cents, currency)}
          loading={loadingFirst}
          hint={t("kpi.lifetime")}
        />
        <MetricCard
          label={t("kpi.avgOrders")}
          value={((s?.avg_orders_per_customer_x100 ?? 0) / 100).toFixed(1)}
          loading={loadingFirst}
          hint={t("kpi.perCustomer")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("kpi.newCustomers")}
          value={(s?.new_customers ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.window")}
        />
        <MetricCard
          label={t("kpi.returningCustomers")}
          value={(s?.returning_customers ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.window")}
        />
        <MetricCard
          label={t("kpi.activeCustomers")}
          value={(s?.active_customers ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.window")}
        />
        <MetricCard
          label={t("kpi.windowRevenue")}
          value={formatMoneyCents(s?.window_revenue_cents, currency)}
          loading={loadingFirst}
          hint={t("kpi.window")}
        />
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t("cohorts.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("cohorts.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <Bones name="customer-analytics-cohorts" loading={loadingFirst}>
            {cohortRows.every((c) => c.size === 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("cohorts.empty")}
              </p>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-center text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-2 py-1 text-start font-medium">
                      {t("cohorts.cohort")}
                    </th>
                    <th className="px-2 py-1 font-medium">{t("cohorts.size")}</th>
                    {Array.from({ length: maxPeriods }).map((_, k) => (
                      <th key={k} className="px-2 py-1 font-medium">
                        M{k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortRows.map((c) => (
                    <tr key={c.cohort}>
                      <td className="px-2 py-1 text-start whitespace-nowrap text-muted-foreground">
                        {c.cohort}
                      </td>
                      <td className="px-2 py-1 font-medium">{c.size}</td>
                      {Array.from({ length: maxPeriods }).map((_, k) => {
                        const bps = c.retention_bps[k]
                        if (bps == null)
                          return <td key={k} className="px-2 py-1" />
                        return (
                          <td
                            key={k}
                            className="rounded px-2 py-1"
                            style={cohortCellStyle(bps)}
                          >
                            {bpsToPercent(bps).toFixed(0)}%
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </Bones>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t("top.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Bones name="customer-analytics-top" loading={loadingFirst}>
            {(report?.top_customers.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("top.empty")}
              </p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("top.customer")}</TableHead>
                  <TableHead className="text-end">{t("top.orders")}</TableHead>
                  <TableHead className="text-end">{t("top.spent")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report?.top_customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{c.name ?? t("top.unknown")}</span>
                        {c.email ? (
                          <span className="text-xs text-muted-foreground">
                            {c.email}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {c.orders_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatMoneyCents(c.total_spent_cents, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </Bones>
        </CardContent>
      </Card>
    </div>
  )
}
