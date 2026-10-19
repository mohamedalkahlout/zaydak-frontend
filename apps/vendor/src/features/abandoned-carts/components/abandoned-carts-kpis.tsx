"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  LineChartIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
} from "lucide-react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import { GET_ABANDONED_CARTS_SUMMARY } from "@/features/abandoned-carts/api"
import type { AbandonedCartsSummaryResponse } from "@/features/abandoned-carts/types"
import type {
  AbandonedCartsQueryState,
  RangePreset,
} from "@/features/abandoned-carts/lib/query-state"
import { toAbandonedCartsSummaryVariables } from "@/features/abandoned-carts/lib/query-state"
import { AbandonedCartsRange } from "./abandoned-carts-range"

export function AbandonedCartsKpis({
  rangeState,
  now,
  onRangeChange,
}: {
  rangeState: Pick<AbandonedCartsQueryState, "range" | "from" | "to">
  /**
   * The instant a rolling range ends at, held in state by the table. It is
   * required: read here as `new Date()`, the window's end moved on every
   * render and the summary refetched without end. Passing the table's own
   * also makes this the same query the table runs, answered once.
   */
  now: Date
  onRangeChange: (next: { range: RangePreset; from?: string; to?: string }) => void
}) {
  const t = useTranslations("abandonedCarts")
  const { data, previousData } = useQuery<AbandonedCartsSummaryResponse>(
    GET_ABANDONED_CARTS_SUMMARY,
    {
      variables: toAbandonedCartsSummaryVariables(rangeState, now),
      notifyOnNetworkStatusChange: true,
    },
  )
  const summary = (data ?? previousData)?.abandonedCartsSummary.data
  if (!summary) {
    return (
      <AbandonedCartsKpisSkeleton
        rangeState={rangeState}
        onRangeChange={onRangeChange}
      />
    )
  }
  const total = summary.total_abandoned ?? 0
  const recovery = summary.recovery_rate ?? 0
  const average = summary.average_cart_cents ?? 0
  const currency = summary.currency ?? "SAR"

  return (
    <AbandonedCartsKpisFrame rangeState={rangeState} onRangeChange={onRangeChange}>
      <KpiCard
        label={t("kpi.total")}
        value={String(total)}
        icon={ShoppingCartIcon}
        chipClass="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
      />
      <KpiCard
        label={t("kpi.recovered")}
        value={`${recovery}%`}
        icon={ShoppingBagIcon}
        chipClass="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      />
      <KpiCard
        label={t("kpi.average")}
        value={formatMoneyCents(average, currency)}
        icon={LineChartIcon}
        chipClass="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      />
    </AbandonedCartsKpisFrame>
  )
}

export function AbandonedCartsKpisSkeleton({
  rangeState,
  onRangeChange,
}: {
  rangeState: Pick<AbandonedCartsQueryState, "range" | "from" | "to">
  onRangeChange: (next: { range: RangePreset; from?: string; to?: string }) => void
}) {
  return (
    <AbandonedCartsKpisFrame rangeState={rangeState} onRangeChange={onRangeChange}>
      <KpiPlaceholder />
      <KpiPlaceholder />
      <KpiPlaceholder />
    </AbandonedCartsKpisFrame>
  )
}

function AbandonedCartsKpisFrame({
  rangeState,
  onRangeChange,
  children,
}: {
  rangeState: Pick<AbandonedCartsQueryState, "range" | "from" | "to">
  onRangeChange: (next: { range: RangePreset; from?: string; to?: string }) => void
  children: ReactNode
}) {
  const t = useTranslations("abandonedCarts")
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {t("kpi.heading")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("kpi.subheading")}
          </p>
        </div>
        <AbandonedCartsRange state={rangeState} onChange={onRangeChange} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </section>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  chipClass,
}: {
  label: string
  value: string
  icon: LucideIcon
  chipClass: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-heading text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      </div>
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          chipClass,
        )}
      >
        <Icon className="size-5" />
      </div>
    </div>
  )
}

function KpiPlaceholder() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
    </div>
  )
}
