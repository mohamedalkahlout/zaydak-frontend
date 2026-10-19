"use client"

import { useCallback, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useApolloClient, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  type PaginationState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { DownloadIcon, HandshakeIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent } from "@repo/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Switch } from "@repo/ui/components/switch"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format"
import { downloadCsv, toCsv } from "@/shared/lib/csv"
import { MetricCard } from "@/features/analytics/components/metric-card"
import {
  rangeForPreset,
  RANGE_PRESETS,
  type RangePreset,
} from "@/features/analytics/lib/date-ranges"
import { useFeature } from "@/features/plan/lib/use-feature"
import {
  NEGOTIATION_OUTCOME_ROLLUPS,
  NEGOTIATION_OUTCOMES,
} from "../api-outcomes"
import type {
  NegotiationOutcome,
  NegotiationOutcomeRollupsResponse,
  NegotiationOutcomeRollupsVariables,
  NegotiationOutcomesResponse,
  NegotiationOutcomesVariables,
} from "../types"
import {
  buildOutcomesFilter,
  CHANNELS,
  OUTCOMES_EXPORT_LIMIT,
  OUTCOMES_PAGE_SIZE,
  outcomesCsvRows,
  ROLLUP_PRODUCT_LIMIT,
  SESSION_STATUSES,
  type ChannelFilter,
  type StatusFilter,
} from "../lib/outcomes"
import { negotiationOutcomeColumns } from "./negotiation-outcomes-columns"
import {
  NegotiationProductRollupsCard,
  NegotiationStrategyRollupsCard,
} from "./negotiation-rollups-card"
import { NegotiationTrendCard } from "./negotiation-trend-card"

function percent(bps: number | null | undefined): string {
  return bpsToPercent(bps).toFixed(0)
}

/**
 * `/store/[shopSlug]/analytics/negotiations` — which negotiations closed, at
 * what price, and what each deal cost.
 *
 * The KPI row is the back-end's `summary`, computed over every session in the
 * window rather than over the page on screen, and its money counts redeemed
 * deals only. Gated on `ai.negotiation` like the policy card: a plan without it
 * gets a quiet note and no query, since the resolver would only answer
 * FEATURE_NOT_AVAILABLE.
 *
 * Below it, the same report grouped — a trend, by product, by strategy — from
 * `negotiationOutcomeRollups`, a second query sharing the table's filter but
 * never its page. A failure of that query, including one from an API image
 * that lacks the field, shows in the three cards. The KPI row and the table
 * render as before.
 */
export function NegotiationOutcomesPage() {
  const t = useTranslations("negotiationOutcomes")
  const tAnalytics = useTranslations("analytics")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const feature = useFeature("ai.negotiation")

  const [preset, setPreset] = useState<RangePreset>("last_30_days")
  const [status, setStatus] = useState<StatusFilter>("ALL")
  const [channel, setChannel] = useState<ChannelFilter>("ALL")
  const [redeemedOnly, setRedeemedOnly] = useState(false)
  // One product, drilled into from a row. The API has always taken it.
  const [product, setProduct] = useState<{ id: string; title: string } | null>(
    null,
  )
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const client = useApolloClient()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: OUTCOMES_PAGE_SIZE,
  })

  // Anchored on the preset, not recomputed per render: `rangeForPreset` reads
  // the clock, and a window that moved every render would be a new Apollo
  // variable every render.
  const windowRange = useMemo(() => {
    const range = rangeForPreset(preset)
    return { start: range.start.toISOString(), end: range.end.toISOString() }
  }, [preset])

  const resetToFirstPage = () =>
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))

  const filter = buildOutcomesFilter({
    start: windowRange.start,
    end: windowRange.end,
    status,
    channel,
    redeemedOnly,
    productId: product?.id,
  })

  const { data, previousData, loading, error } = useQuery<
    NegotiationOutcomesResponse,
    NegotiationOutcomesVariables
  >(NEGOTIATION_OUTCOMES, {
    variables: {
      filter,
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    },
    skip: !feature.allowed,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  })

  const result = (data ?? previousData)?.negotiationOutcomes
  const rows = useMemo<NegotiationOutcome[]>(() => result?.data ?? [], [result])
  const summary = result?.summary
  const totalCount = result?.meta?.total ?? 0
  const currency = summary?.currency
  const loadingFirst = (loading || feature.loading) && !result

  const rollupsQuery = useQuery<
    NegotiationOutcomeRollupsResponse,
    NegotiationOutcomeRollupsVariables
  >(NEGOTIATION_OUTCOME_ROLLUPS, {
    // The table's filter, never its page: one grouping per filter.
    variables: { filter, product_limit: ROLLUP_PRODUCT_LIMIT },
    skip: !feature.allowed,
    fetchPolicy: "cache-and-network",
    // The breakdown owns its error state (each card says so), so the error
    // link does not also report a failure of it.
    context: { silentErrors: true },
  })
  const rollups = (rollupsQuery.data ?? rollupsQuery.previousData)
    ?.negotiationOutcomeRollups?.data
  const rollupsLoading = rollupsQuery.loading || feature.loading
  const rollupsFailed = !!rollupsQuery.error

  // The same drill-down from a row and from the product breakdown.
  const drillIntoProduct = useCallback(
    (next: { id: string; title: string }) => {
      setProduct(next)
      setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
    },
    [],
  )

  const columns = useMemo(
    () =>
      negotiationOutcomeColumns({
        shopSlug,
        t,
        onProduct: (row) =>
          drillIntoProduct({ id: row.product_id, title: row.product_title }),
      }),
    [shopSlug, t, drillIntoProduct],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination },
    manualPagination: true,
    rowCount: totalCount,
    autoResetPageIndex: false,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilters =
    status !== "ALL" || channel !== "ALL" || redeemedOnly || product !== null

  /**
   * Every row the filter matches, not the page on screen: fetched a hundred at
   * a time (the API's page ceiling) and capped at `OUTCOMES_EXPORT_LIMIT`.
   */
  const exportCsv = async () => {
    setExporting(true)
    setExportFailed(false)
    try {
      const all: NegotiationOutcome[] = []
      for (let page = 1; all.length < OUTCOMES_EXPORT_LIMIT; page++) {
        const { data: pageData } = await client.query<
          NegotiationOutcomesResponse,
          NegotiationOutcomesVariables
        >({
          query: NEGOTIATION_OUTCOMES,
          variables: { filter, page, limit: 100 },
          fetchPolicy: "network-only",
        })
        const chunk = pageData?.negotiationOutcomes?.data ?? []
        all.push(...chunk)
        const pages = pageData?.negotiationOutcomes?.meta?.total_pages ?? 0
        if (chunk.length === 0 || page >= pages) break
      }
      downloadCsv(
        `negotiations-${windowRange.start.slice(0, 10)}-${windowRange.end.slice(0, 10)}.csv`,
        toCsv(outcomesCsvRows(all.slice(0, OUTCOMES_EXPORT_LIMIT))),
      )
    } catch {
      setExportFailed(true)
    } finally {
      setExporting(false)
    }
  }
  const pageStart = pagination.pageIndex * pagination.pageSize
  const pageEnd = Math.min(pageStart + rows.length, totalCount)

  const header = (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      {feature.allowed ? (
        <Select
          value={preset}
          onValueChange={(v) => {
            setPreset(v as RangePreset)
            resetToFirstPage()
          }}
        >
          <SelectTrigger className="w-44" aria-label={t("filters.range")}>
            <SelectValue>
              {(value: RangePreset | null) =>
                tAnalytics(`ranges.${value ?? "last_30_days"}`)
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
      ) : null}
    </header>
  )

  if (!feature.loading && !feature.allowed) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("notOnPlan")}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <HandshakeIcon className="size-6 stroke-[1.25]" />
      </div>
      {hasFilters ? (
        <p className="mt-4 text-sm font-medium">{t("empty.noMatch")}</p>
      ) : (
        <>
          <h2 className="mt-4 text-base font-semibold">{t("empty.title")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("empty.body")}
          </p>
        </>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label={t("kpi.sessions")}
          value={(summary?.sessions ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.acceptedHint", {
            accepted: summary?.accepted ?? 0,
            rate: percent(summary?.acceptance_bps),
          })}
        />
        <MetricCard
          label={t("kpi.redeemed")}
          value={(summary?.redeemed ?? 0).toLocaleString()}
          loading={loadingFirst}
          hint={t("kpi.conversionHint", {
            rate: percent(summary?.conversion_bps),
          })}
        />
        <MetricCard
          label={t("kpi.revenue")}
          value={formatMoneyCents(summary?.revenue_cents ?? 0, currency)}
          loading={loadingFirst}
          hint={t("kpi.revenueHint")}
        />
        <MetricCard
          label={t("kpi.discount")}
          value={formatMoneyCents(summary?.discount_cents ?? 0, currency)}
          loading={loadingFirst}
          hint={t("kpi.discountHint")}
        />
        <MetricCard
          label={t("kpi.margin")}
          value={formatMoneyCents(summary?.margin_cents, currency)}
          loading={loadingFirst}
          hint={
            summary && summary.redeemed_without_cost > 0
              ? t("kpi.marginMissingCost", {
                  count: summary.redeemed_without_cost,
                })
              : t("kpi.marginHint")
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">{t("definitions")}</p>

      <section className="flex flex-col gap-4">
        <NegotiationTrendCard
          rollups={rollups}
          loading={rollupsLoading}
          failed={rollupsFailed}
        />
        <NegotiationProductRollupsCard
          rollups={rollups}
          loading={rollupsLoading}
          failed={rollupsFailed}
          onProduct={drillIntoProduct}
        />
        <NegotiationStrategyRollupsCard
          rollups={rollups}
          loading={rollupsLoading}
          failed={rollupsFailed}
        />
        <p className="text-xs text-muted-foreground">
          {t("rollups.definitions")}
        </p>
      </section>

      <DataTableCard>
        <DataTableToolbar
          leading={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as StatusFilter)
                  resetToFirstPage()
                }}
              >
                <SelectTrigger size="sm" aria-label={t("columns.status")}>
                  <SelectValue>
                    {(value: StatusFilter | null) =>
                      !value || value === "ALL"
                        ? t("filters.allStatuses")
                        : t(`sessionStatus.${value}`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("filters.allStatuses")}</SelectItem>
                  {SESSION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`sessionStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={channel}
                onValueChange={(v) => {
                  setChannel(v as ChannelFilter)
                  resetToFirstPage()
                }}
              >
                <SelectTrigger size="sm" aria-label={t("columns.channel")}>
                  <SelectValue>
                    {(value: ChannelFilter | null) =>
                      !value || value === "ALL"
                        ? t("filters.allChannels")
                        : t(`channel.${value}`)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("filters.allChannels")}</SelectItem>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`channel.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={redeemedOnly}
                  onCheckedChange={(checked) => {
                    setRedeemedOnly(checked)
                    resetToFirstPage()
                  }}
                />
                {t("filters.redeemedOnly")}
              </label>
              {product ? (
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                  {t("filters.product", { name: product.title })}
                  <button
                    type="button"
                    aria-label={t("filters.clearProduct")}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setProduct(null)
                      resetToFirstPage()
                    }}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              ) : null}
            </div>
          }
          trailing={
            <div className="flex items-center gap-2">
              {exportFailed ? (
                <span role="alert" className="text-xs text-destructive">
                  {t("exportFailed")}
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={exporting || totalCount === 0}
                onClick={() => void exportCsv()}
              >
                <DownloadIcon className="size-4" />
                {exporting ? t("exporting") : t("export")}
              </Button>
            </div>
          }
        />

        {error && !result ? (
          <p className="px-3 py-10 text-center text-sm text-destructive">
            {t("error")}
          </p>
        ) : loadingFirst ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {t("loading")}
          </p>
        ) : (
          <DataTable table={table} emptyState={emptyState} />
        )}

        {totalCount > pagination.pageSize ? (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t("pagination", {
                from: totalCount === 0 ? 0 : pageStart + 1,
                to: pageEnd,
                total: totalCount,
              })}
            </p>
            <DataTablePagination table={table} />
          </DataTableFooter>
        ) : null}
      </DataTableCard>
    </div>
  )
}
