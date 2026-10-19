"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
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
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeletonRows,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { formatAmountCents, formatDate } from "@/shared/lib/format"
import { ADMIN_USAGE_LEDGER, ADMIN_USAGE_SUMMARY } from "../api"

const PAGE_SIZE = 20

/** The windows the screen offers, in days. The server defaults to 30. */
const WINDOWS = [7, 30, 90] as const

/**
 * What one store has consumed, and what it cost us.
 *
 * The console could previously reset a shop's quota without ever being able to
 * see what had spent it. This is `usage_events` — the append-only ledger the
 * entitlements engine writes on every metered call, including the AI images
 * whose consumption is DERIVED from their own rows and therefore never touched
 * a counter.
 *
 * **`cost_cents` is here and nowhere the vendor can reach it.** It is what the
 * platform paid a provider for that call, which is our margin; the vendor's own
 * `myUsageEvents` is a projection with the field removed.
 */
/** Start of a rolling window, N days back from now. */
const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString()

export function ShopUsage({
  shopId,
  shopSlug,
}: {
  shopId: string
  shopSlug: string
}) {
  const t = useTranslations("plans")
  const locale = useLocale()
  const [days, setDays] = useState<number>(30)
  // Anchored when the range is picked, not read during render. `Date.now()` in
  // the render body is impure AND moved `from` on every single render, so the
  // query variables changed identity constantly and Apollo could never serve
  // the window from cache.
  const [from, setFrom] = useState(() => isoDaysAgo(30))
  const [featureKey, setFeatureKey] = useState("all")
  const [page, setPage] = useState(1)

  const { data: summaryData } = useQuery(ADMIN_USAGE_SUMMARY, {
    variables: { shop_id: shopId, from },
    fetchPolicy: "cache-and-network",
  })
  const { data, loading } = useQuery(ADMIN_USAGE_LEDGER, {
    variables: {
      shop_id: shopId,
      from,
      page,
      limit: PAGE_SIZE,
      feature_key: featureKey === "all" ? undefined : featureKey,
    },
    fetchPolicy: "cache-and-network",
  })

  const summary = summaryData?.usageSummary.data ?? []
  const rows = data?.usageLedger.data ?? []
  const meta = data?.usageLedger.meta
  const totalCost = summary.reduce((sum, row) => sum + row.cost_cents, 0)

  const changeWindow = (next: number) => {
    setDays(next)
    setFrom(isoDaysAgo(next))
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-medium">{t("usageTitle")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("usageHint")}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeWindow(value)}
              aria-pressed={days === value}
              className={
                days === value
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {t("lastDays", { days: value })}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Totals per capability ────────────────────────────────────── */}
      <DataTableCard>
        <DataTableToolbar>
          <span className="text-sm font-medium">{t("consumed")}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("totalCost")}: {formatAmountCents(totalCost, locale)}
          </span>
        </DataTableToolbar>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("col.capability")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.calls")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("col.quantity")}
            </DataTableHead>
            <DataTableHead className="text-end">{t("col.cost")}</DataTableHead>
          </DataTableHeader>
          <TableBody>
            {summary.map((row) => (
              <DataTableRow key={row.feature_key}>
                <DataTableCell>
                  <div className="font-medium">{row.feature_name}</div>
                  <code className="text-xs text-muted-foreground">
                    {row.feature_key}
                  </code>
                </DataTableCell>
                <DataTableCell className="text-end tabular-nums">
                  {row.events}
                </DataTableCell>
                <DataTableCell className="text-end tabular-nums">
                  {row.quantity}
                </DataTableCell>
                <DataTableCell className="text-end tabular-nums">
                  {formatAmountCents(row.cost_cents, locale)}
                </DataTableCell>
              </DataTableRow>
            ))}
            {summary.length === 0 && (
              <DataTableEmpty colSpan={4}>{t("usageEmpty")}</DataTableEmpty>
            )}
          </TableBody>
        </Table>
      </DataTableCard>

      {/* ─── The ledger itself ────────────────────────────────────────── */}
      <DataTableCard>
        <DataTableToolbar>
          <span className="text-sm font-medium">{t("activity")}</span>
          <Select
            value={featureKey}
            onValueChange={(value) => {
              if (value === null) return
              setFeatureKey(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCapabilities")}</SelectItem>
              {summary.map((row) => (
                <SelectItem key={row.feature_key} value={row.feature_key}>
                  {row.feature_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DataTableToolbar>

        <Table>
          <DataTableHeader>
            <DataTableHead>{t("col.when")}</DataTableHead>
            <DataTableHead>{t("col.capability")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("col.quantity")}
            </DataTableHead>
            <DataTableHead className="text-end">{t("col.cost")}</DataTableHead>
          </DataTableHeader>
          <TableBody>
            {loading && !rows.length ? (
              <DataTableSkeletonRows columns={4} />
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="whitespace-nowrap">
                    {formatDate(row.created_at, locale)}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{row.feature_name}</span>
                      {/*
                        A zero-quantity row is a refund, not a mystery: the work
                        failed and the allowance went back. The cost usually did
                        not — the provider call had already happened.
                      */}
                      {row.released && (
                        <Badge variant="secondary">{t("refunded")}</Badge>
                      )}
                    </div>
                    {row.ref_type && (
                      <code className="text-xs text-muted-foreground">
                        {row.ref_type}
                        {row.ref_id ? `:${row.ref_id.slice(0, 8)}` : ""}
                      </code>
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {row.released ? "—" : row.quantity}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatAmountCents(row.cost_cents, locale)}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
            {!loading && !rows.length && (
              <DataTableEmpty colSpan={4}>{t("activityEmpty")}</DataTableEmpty>
            )}
          </TableBody>
        </Table>

        {meta && meta.total_pages > 1 && (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("page", { page: meta.page, total: meta.total_pages })} ·{" "}
              {shopSlug}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page >= meta.total_pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </DataTableFooter>
        )}
      </DataTableCard>
    </div>
  )
}
