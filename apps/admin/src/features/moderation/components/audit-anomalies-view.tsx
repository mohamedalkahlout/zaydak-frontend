"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ActivityIcon, AlertTriangleIcon, ShieldCheckIcon, ZapIcon } from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Table, TableBody } from "@repo/ui/components/table"

import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeletonRows,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { formatDateTime } from "@/shared/lib/format"

import { AUDIT_ANOMALIES } from "../api"

const WINDOW_OPTIONS = [
  { label: "24 Hours", value: "24" },
  { label: "48 Hours", value: "48" },
  { label: "7 Days", value: "168" },
]

export function AuditAnomaliesView() {
  const t = useTranslations("moderation.anomalies")
  const locale = useLocale()
  const [hoursBack, setHoursBack] = useState<number>(24)

  const { data, loading, refetch } = useQuery(AUDIT_ANOMALIES, {
    variables: {
      input: {
        hours_back: hoursBack,
        spike_multiplier: 5,
      },
    },
    fetchPolicy: "cache-and-network",
  })

  const summary = data?.auditAnomalies?.data
  const spikes = summary?.spikes ?? []
  const sensitiveEvents = summary?.sensitive_events ?? []

  return (
    <div className="space-y-6">
      <DataTableToolbar>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("lookbackWindow")}:</span>
          <Select
            value={String(hoursBack)}
            onValueChange={(val) => {
              if (val) setHoursBack(Number(val))
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DataTableToolbar>

      {/* Summary metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("metrics.totalEvents")}
            </CardTitle>
            <ActivityIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : summary?.total_events ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("metrics.sensitiveEvents")}
            </CardTitle>
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
              {loading ? "…" : summary?.sensitive_events_count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("metrics.spikesDetected")}
            </CardTitle>
            <ZapIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {loading ? "…" : spikes.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("metrics.criticalEntries")}
            </CardTitle>
            <AlertTriangleIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : summary?.recent_critical?.length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spikes Table */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">{t("sections.spikes")}</h3>
        <DataTableCard>
          <Table>
            <DataTableHeader>
              <DataTableHead>{t("column.actor")}</DataTableHead>
              <DataTableHead>{t("column.recentCount")}</DataTableHead>
              <DataTableHead>{t("column.baselineCount")}</DataTableHead>
              <DataTableHead>{t("column.spikeRatio")}</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {loading && spikes.length === 0 ? (
                <DataTableSkeletonRows columns={4} rows={3} />
              ) : spikes.length === 0 ? (
                <DataTableEmpty colSpan={4}>{t("noSpikes")}</DataTableEmpty>
              ) : (
                spikes.map((spike, idx) => (
                  <DataTableRow key={spike.user_id ?? idx}>
                    <DataTableCell>
                      <div className="font-medium text-sm">
                        {spike.user_name || <span className="text-muted-foreground italic">—</span>}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {spike.user_id}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="font-semibold text-sm">
                      {spike.recent_count}
                    </DataTableCell>
                    <DataTableCell className="text-sm text-muted-foreground">
                      {spike.baseline_count}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="destructive">
                        {spike.spike_ratio.toFixed(1)}x
                      </Badge>
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>

      {/* Sensitive Operations Stream */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">{t("sections.sensitiveActivity")}</h3>
        <DataTableCard>
          <Table>
            <DataTableHeader>
              <DataTableHead>{t("column.actor")}</DataTableHead>
              <DataTableHead>{t("column.action")}</DataTableHead>
              <DataTableHead>{t("column.entity")}</DataTableHead>
              <DataTableHead>{t("column.ip")}</DataTableHead>
              <DataTableHead>{t("column.created")}</DataTableHead>
            </DataTableHeader>
            <TableBody>
              {loading && sensitiveEvents.length === 0 ? (
                <DataTableSkeletonRows columns={5} rows={5} />
              ) : sensitiveEvents.length === 0 ? (
                <DataTableEmpty colSpan={5}>{t("noSensitiveActivity")}</DataTableEmpty>
              ) : (
                sensitiveEvents.map((evt) => (
                  <DataTableRow key={evt.id}>
                    <DataTableCell>
                      <div className="font-medium text-sm">
                        {evt.user_name || <span className="text-muted-foreground italic">—</span>}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {evt.user_id}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {evt.action}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell className="text-xs font-mono text-muted-foreground">
                      {evt.entity} {evt.entity_id ? `(${evt.entity_id})` : ""}
                    </DataTableCell>
                    <DataTableCell className="text-xs font-mono text-muted-foreground">
                      {evt.ip || "—"}
                    </DataTableCell>
                    <DataTableCell className="text-xs text-muted-foreground">
                      {formatDateTime(evt.created_at, locale)}
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>
    </div>
  )
}
