"use client"

import { useState } from "react"
import { useQuery, useLazyQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
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
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import {
  rangeForPreset,
  RANGE_PRESETS,
  type RangePreset,
} from "@/features/analytics/lib/date-ranges"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { GET_REPORT_SCHEMA, RUN_REPORT } from "../api/queries"
import type {
  ReportColumn,
  ReportSchemaResponse,
  RunReportResponse,
} from "../types"

function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        disabled
          ? "cursor-not-allowed border-border text-muted-foreground/50"
          : selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  )
}

function formatCell(
  value: string | number | null,
  column: ReportColumn,
  currency: string,
): string {
  if (value == null) return "—"
  if (column.kind === "money") return formatMoneyCents(Number(value), currency)
  if (column.role === "measure") return Number(value).toLocaleString()
  return String(value)
}

export function ReportBuilder() {
  const t = useTranslations("reports")
  const tAnalytics = useTranslations("analytics")
  const schemaQuery = useQuery<ReportSchemaResponse>(GET_REPORT_SCHEMA)
  const schema = schemaQuery.data?.reportSchema?.data

  const [dimensions, setDimensions] = useState<string[]>([])
  const [measures, setMeasures] = useState<string[]>([])
  const [preset, setPreset] = useState<RangePreset>("last_30_days")

  const [run, runState] = useLazyQuery<RunReportResponse>(RUN_REPORT)
  const result = runState.data?.runReport?.data

  const maxDims = schema?.max_dimensions ?? 3

  const toggle = (
    list: string[],
    set: (v: string[]) => void,
    key: string,
    max?: number,
  ) => {
    if (list.includes(key)) set(list.filter((k) => k !== key))
    else if (!max || list.length < max) set([...list, key])
  }

  const canRun = dimensions.length > 0 && measures.length > 0

  const onRun = () => {
    if (!canRun) return
    const range = rangeForPreset(preset)
    void run({
      variables: {
        input: {
          dimensions,
          measures,
          start: range.start.toISOString(),
          end: range.end.toISOString(),
          limit: 100,
        },
      },
    })
  }

  const currency = result?.currency ?? "SAR"

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{t("build")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Bones
            name="report-builder-controls"
            loading={schemaQuery.loading && !schema}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("dimensions")} ({dimensions.length}/{maxDims})
                </span>
                <div className="flex flex-wrap gap-2">
                  {schema?.dimensions.map((d) => (
                    <Chip
                      key={d.key}
                      label={t(`dim.${d.key}`)}
                      selected={dimensions.includes(d.key)}
                      disabled={
                        !dimensions.includes(d.key) &&
                        dimensions.length >= maxDims
                      }
                      onClick={() =>
                        toggle(dimensions, setDimensions, d.key, maxDims)
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("measures")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {schema?.measures.map((m) => {
                    const pending = m.availability !== "available"
                    return (
                      <Chip
                        key={m.key}
                        label={
                          pending
                            ? `${t(`measure.${m.key}`)} · ${t("pending")}`
                            : t(`measure.${m.key}`)
                        }
                        selected={measures.includes(m.key)}
                        disabled={pending}
                        onClick={() => toggle(measures, setMeasures, m.key)}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Select
                  value={preset}
                  onValueChange={(v) => setPreset(v as RangePreset)}
                >
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
                <Button onClick={onRun} disabled={!canRun || runState.loading}>
                  {runState.loading ? t("running") : t("run")}
                </Button>
              </div>
            </div>
          </Bones>
        </CardContent>
      </Card>

      {result ? (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>{t("results")}</CardTitle>
          </CardHeader>
          <CardContent>
            {result.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {tAnalytics("empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((c) => (
                      <TableHead
                        key={c.key}
                        className={cn(c.role === "measure" && "text-end")}
                      >
                        {c.role === "dimension"
                          ? t(`dim.${c.key}`)
                          : t(`measure.${c.key}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i}>
                      {result.columns.map((c) => (
                        <TableCell
                          key={c.key}
                          className={cn(
                            "tabular-nums",
                            c.role === "measure" && "text-end",
                          )}
                        >
                          {formatCell(row[c.key], c, currency)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    {result.columns.map((c, i) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "font-medium tabular-nums",
                          c.role === "measure" && "text-end",
                        )}
                      >
                        {i === 0
                          ? t("total")
                          : c.role === "measure"
                            ? formatCell(result.totals[c.key], c, currency)
                            : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            )}
            {result.truncated ? (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                {t("truncated")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
