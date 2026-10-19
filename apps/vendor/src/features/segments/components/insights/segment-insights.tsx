"use client"

import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  DollarSignIcon,
  MailIcon,
  MessageSquareIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "lucide-react"
import { GET_SEGMENT_INSIGHTS } from "@/features/segments/api"
import type { SegmentInsightsResponse } from "@/features/segments/types"
import { centsToMajor } from "@/shared/lib/format"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { Skeleton } from "@repo/ui/components/skeleton"
import { InsightsStatCard } from "./insights-stat-card"
import { InsightsTopList } from "./insights-top-list"
import { SizeHistoryChart } from "./size-history-chart"

/**
 * Segment Insights tab — the "customer intelligence" view of a segment.
 *
 * Layout:
 *   [Size history chart (full width)]
 *   [4-up KPI grid: count + base%, avg spend, median spend, avg orders]
 *   [2-up subscription cards: email %, SMS %]
 *   [3-up Top lists: countries, cities, languages]
 *
 * Reads `segmentInsights(id)` — the backend computes everything against
 * the live segment where clause، so any rules change is reflected
 * immediately when the vendor opens this tab.
 */

interface SegmentInsightsProps {
  segmentId: string
}

/**
 * A country or language code in the dashboard's language ("SA" → "Saudi
 * Arabia" / "السعودية"). Contacts carry whatever their source wrote, so a
 * value that is not a bare code — a name already — is shown as it came.
 */
function displayName(
  locale: string,
  type: "region" | "language",
  value: string,
): string {
  const isCode =
    type === "region"
      ? /^[A-Za-z]{2}$/.test(value)
      : /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)
  if (!isCode) return value
  try {
    const names = new Intl.DisplayNames([locale], { type })
    return names.of(type === "region" ? value.toUpperCase() : value) ?? value
  } catch {
    return value
  }
}

export function SegmentInsights({ segmentId }: SegmentInsightsProps) {
  const t = useTranslations("segments.insights")
  const locale = useLocale()
  const currency = useShopCurrency()
  const { data, loading, error } = useQuery<SegmentInsightsResponse>(
    GET_SEGMENT_INSIGHTS,
    {
      variables: { id: segmentId },
      fetchPolicy: "cache-and-network",
    },
  )

  if (loading && !data) {
    return <InsightsSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {t("loadFailed", { message: error.message })}
      </div>
    )
  }

  const insights = data?.segmentInsights?.data
  if (!insights) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  }

  const percentFmt = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  })
  // Spend arrives as integer cents; scale once, here.
  const spendFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  })
  const formatSpendCents = (cents: number) =>
    spendFmt.format(centsToMajor(cents))
  const countFmt = new Intl.NumberFormat(locale)
  const ordersFmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  const basePct =
    insights.baseCount > 0
      ? percentFmt.format(insights.count / insights.baseCount)
      : "—"

  return (
    <div className="flex flex-col gap-4">
      {/* Size history (full width) */}
      <SizeHistoryChart points={insights.sizeHistory} />

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightsStatCard
          icon={<UsersIcon className="size-3.5" />}
          label={t("members")}
          value={countFmt.format(insights.count)}
          caption={t("ofBase", { percent: basePct })}
          tone="positive"
        />
        <InsightsStatCard
          icon={<DollarSignIcon className="size-3.5" />}
          label={t("avgSpend")}
          value={formatSpendCents(insights.avgTotalSpentCents)}
        />
        <InsightsStatCard
          icon={<DollarSignIcon className="size-3.5" />}
          label={t("medianSpend")}
          value={formatSpendCents(insights.medianTotalSpentCents)}
        />
        <InsightsStatCard
          icon={<ShoppingBagIcon className="size-3.5" />}
          label={t("avgOrders")}
          value={ordersFmt.format(insights.avgOrdersCount)}
        />
      </div>

      {/* Subscriptions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightsStatCard
          icon={<MailIcon className="size-3.5" />}
          label={t("emailSubscribed")}
          value={percentFmt.format(insights.emailSubscribedRatio)}
          caption={t("ofMembers", { count: insights.count })}
        />
        <InsightsStatCard
          icon={<MessageSquareIcon className="size-3.5" />}
          label={t("smsSubscribed")}
          value={percentFmt.format(insights.smsSubscribedRatio)}
          caption={t("ofMembers", { count: insights.count })}
        />
      </div>

      {/* Top lists */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InsightsTopList
          title={t("topCountries")}
          items={insights.topCountries}
          formatValue={(value) => displayName(locale, "region", value)}
        />
        <InsightsTopList title={t("topCities")} items={insights.topCities} />
        <InsightsTopList
          title={t("topLanguages")}
          items={insights.topLanguages}
          formatValue={(value) => displayName(locale, "language", value)}
        />
      </div>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
