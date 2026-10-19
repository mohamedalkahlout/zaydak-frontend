"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bones } from "@/shared/components/bones"
import { ORDER_STATUS_ROWS, type OrderStatusCounts } from "../types"
import { barShare, formatCount } from "../lib/analytics"
import { AnalyticsPanel } from "./panel"

/**
 * Every order on the platform, split by status.
 *
 * The back-end counts **leaf orders only** here — without that filter a global
 * count double-counts each multi-shop parent alongside its children, which is
 * exactly the bug its comment says this replaced. So these figures reconcile
 * with `analytics.total_orders`, and the panel states the total to make that
 * checkable at a glance.
 *
 * Statuses with a zero count are dropped rather than shown as empty bars: on a
 * platform-wide view most of the unhappy states are usually zero, and eight
 * rows of nothing buries the four that matter.
 */
export function OrdersByStatusCard({
  counts,
  loading,
}: {
  counts?: OrderStatusCounts
  loading: boolean
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()

  // Resolve each count once, here, so the render below reads a plain number and
  // nothing needs a non-null assertion on `counts`.
  const rows = counts
    ? ORDER_STATUS_ROWS.map((row) => ({ ...row, count: counts[row.key] })).filter(
        (row) => row.count > 0,
      )
    : []
  const max = rows.reduce((m, row) => Math.max(m, row.count), 0)
  const total = rows.reduce((sum, row) => sum + row.count, 0)

  return (
    <AnalyticsPanel
      title={t("ordersByStatus.title")}
      description={
        counts
          ? t("ordersByStatus.subtitle", { total: formatCount(total, locale) })
          : undefined
      }
    >
      <Bones name="admin-orders-by-status" loading={loading}>
        <div className="flex flex-col gap-2.5">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("ordersByStatus.empty")}
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t(`status.${row.key}`)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCount(row.count, locale)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${barShare(row.count, max)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Bones>
    </AnalyticsPanel>
  )
}
