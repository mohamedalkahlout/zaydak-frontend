"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  ADMIN_PLATFORM_ANALYTICS,
  ADMIN_PLATFORM_COST,
  ADMIN_PLATFORM_SALES_BY_CHANNEL,
  ADMIN_PLATFORM_TOP_PRODUCTS,
} from "../api"
import { formatCount, isoDaysAgo, selectableYears } from "../lib/analytics"
import { isSchemaMismatchError } from "../lib/schema-mismatch"
import { SalesByChannelCard } from "./sales-by-channel-card"
import { formatAmountCents } from "@/shared/lib/format"
import { OrdersByStatusCard } from "./orders-by-status-card"
import { ProviderCostCard } from "./provider-cost-card"
import { RevenueByMonthCard } from "./revenue-by-month-card"
import { StatCard } from "./stat-card"
import { TopProductsCard } from "./top-products-card"
import { TopShopsCostCard } from "./top-shops-cost-card"
import { AiSpendByShopCard } from "./ai-spend-by-shop-card"
import { AiSpendByPlanCard } from "./ai-spend-by-plan-card"
import { ADMIN_PLANS } from "@/features/plans/api"

/** Rolling windows offered for the two cost tables, in days. The server defaults to 30. */
const COST_WINDOWS = [7, 30, 90] as const
/** Rolling windows offered for sales by channel, in days. Up to 92 the server buckets by day. */
const CHANNEL_WINDOWS = [7, 30, 90] as const

/** A rolling window ending now. Called from a state initializer or an event, never a render body. */
function channelWindow(days: number) {
  return { days, start: isoDaysAgo(days), end: new Date().toISOString() }
}
const TOP_SHOPS_LIMIT = 10
const TOP_PRODUCTS_LIMIT = 10

/**
 * Platform analytics — the whole marketplace, not one store.
 *
 * Everything here comes from operations that already existed. The screen is
 * possible because this app sends **no `X-SHOP` header**: the analytics
 * resolver's `resolveShopId` then returns `undefined` and its service omits the
 * shop predicate, so the same aggregates cover every store. See `../api.ts` for
 * why the two guards in front of it let an admin through.
 *
 * Split into four queries by lifecycle, not by card:
 *   - the overview (totals + monthly series + status split) refetches only when
 *     the **year** changes;
 *   - sales by channel refetches only when **its own window** changes (and is
 *     apart for a second reason: see the comment at its query);
 *   - the two cost tables refetch only when the **cost window** changes;
 *   - top products is fetched once.
 * One mega-query would refetch the status split every time someone changed the
 * cost window.
 */
export function PlatformAnalytics() {
  const t = useTranslations("analytics")
  const locale = useLocale()

  // Anchored in state, never read during render. `new Date()` in a render body
  // is impure and would give the query a new `from` on every pass, so Apollo
  // could never serve the window from cache.
  const [currentYear] = useState(() => new Date().getFullYear())
  const [year, setYear] = useState(currentYear)
  const [costDays, setCostDays] = useState<number>(30)
  const [costFrom, setCostFrom] = useState(() => isoDaysAgo(30))
  const [planId, setPlanId] = useState<string | null>(null)
  const [channelRange, setChannelRange] = useState(() => channelWindow(30))

  const overview = useQuery(ADMIN_PLATFORM_ANALYTICS, {
    variables: { year },
    fetchPolicy: "cache-and-network",
  })
  const cost = useQuery(ADMIN_PLATFORM_COST, {
    variables: { from: costFrom, limit: TOP_SHOPS_LIMIT, planId },
    fetchPolicy: "cache-and-network",
  })
  const plansQuery = useQuery(ADMIN_PLANS, {
    fetchPolicy: "cache-first",
  })
  const products = useQuery(ADMIN_PLATFORM_TOP_PRODUCTS, {
    variables: { limit: TOP_PRODUCTS_LIMIT },
    fetchPolicy: "cache-and-network",
  })
  // Its own request, with its own window: an API older than this console
  // rejects the whole document that names `salesByChannel`, so folded into
  // the overview it would blank every card above it.
  const channels = useQuery(ADMIN_PLATFORM_SALES_BY_CHANNEL, {
    variables: {
      input: {
        start: channelRange.start,
        end: channelRange.end,
        compare: true,
      },
    },
    fetchPolicy: "cache-and-network",
  })
  // Across a window change `data` is empty until the new one lands; the
  // previous window's figures are held (dimmed) rather than flashing bones.
  const channelReport =
    channels.data?.salesByChannel.data ??
    channels.previousData?.salesByChannel.data
  // That refusal is permanent until the API is rebuilt, so the panel is left
  // out rather than shown with a retry that can never work.
  const channelsUnsupported = isSchemaMismatchError(channels.error)

  const totals = overview.data?.analytics.data
  const months = overview.data?.yearlySales.data ?? []
  const statuses = overview.data?.ordersByStatus.data

  // `&& !data` everywhere: on a refetch the previous figures stay on screen
  // rather than collapsing back to skeletons.
  const overviewLoading = overview.loading && !overview.data
  const costLoading = cost.loading && !cost.data
  const productsLoading = products.loading && !products.data

  const windowLabel = t("window.lastDays", { days: costDays })

  // `Select` hands back `string | null` (null when cleared). Guarding matters
  // beyond the types: `Number(null)` is 0, which would silently ask for a
  // zero-day window instead of leaving the current one alone.
  function onWindowChange(value: string | null) {
    if (!value) return
    const days = Number(value)
    setCostDays(days)
    setCostFrom(isoDaysAgo(days))
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Money and volume across the marketplace. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("kpi.totalRevenue")}
          value={formatAmountCents(totals?.total_revenue_cents ?? 0, locale)}
          hint={t("kpi.totalRevenueHint")}
          boneName="admin-kpi-total-revenue"
          loading={overviewLoading}
        />
        <StatCard
          label={t("kpi.todaysRevenue")}
          value={formatAmountCents(totals?.todays_revenue_cents ?? 0, locale)}
          boneName="admin-kpi-todays-revenue"
          loading={overviewLoading}
        />
        <StatCard
          label={t("kpi.totalOrders")}
          value={formatCount(totals?.total_orders ?? 0, locale)}
          hint={t("kpi.totalOrdersHint")}
          boneName="admin-kpi-total-orders"
          loading={overviewLoading}
        />
        <StatCard
          label={t("kpi.totalRefunds")}
          value={formatCount(totals?.total_refunds ?? 0, locale)}
          boneName="admin-kpi-total-refunds"
          loading={overviewLoading}
        />
      </div>

      {/* How big the marketplace is. `total_vendors` is the one field the
          back-end populates only for an admin caller — it is null for a vendor
          asking the same query, which is why it belongs on this screen. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("kpi.totalShops")}
          value={formatCount(totals?.total_shops ?? 0, locale)}
          boneName="admin-kpi-total-shops"
          loading={overviewLoading}
        />
        <StatCard
          label={t("kpi.totalVendors")}
          value={formatCount(totals?.total_vendors ?? 0, locale)}
          hint={t("kpi.totalVendorsHint")}
          boneName="admin-kpi-total-vendors"
          loading={overviewLoading}
        />
        <StatCard
          label={t("kpi.newCustomers")}
          value={formatCount(totals?.new_customers ?? 0, locale)}
          hint={t("kpi.newCustomersHint")}
          boneName="admin-kpi-new-customers"
          loading={overviewLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueByMonthCard
          months={months}
          year={year}
          years={selectableYears(currentYear)}
          onYearChange={setYear}
          loading={overviewLoading}
        />
        <OrdersByStatusCard counts={statuses} loading={overviewLoading} />
      </div>

      {channelsUnsupported ? null : (
        <SalesByChannelCard
          report={channelReport}
          loading={channels.loading && !channelReport}
          refreshing={channels.loading && channelReport != null}
          error={channels.error != null}
          onRetry={() => {
            channels.refetch().catch(() => {})
          }}
          days={channelRange.days}
          windows={CHANNEL_WINDOWS}
          onDaysChange={(days) => setChannelRange(channelWindow(days))}
        />
      )}

      {/* The admin-only half: what the platform paid providers, and who spent
          it. Both tables share one window control — they answer the same
          question at two granularities, so letting them drift apart would
          invite comparing a 7-day total against a 90-day ranking. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">
          {t("costSection")}
        </h2>
        <Select value={String(costDays)} onValueChange={onWindowChange}>
          <SelectTrigger className="w-36" aria-label={t("window.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COST_WINDOWS.map((days) => (
              <SelectItem key={days} value={String(days)}>
                {t("window.lastDays", { days })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProviderCostCard
        rows={cost.data?.usageSummary.data ?? []}
        loading={costLoading}
        windowLabel={windowLabel}
      />
      <AiSpendByShopCard
        rows={cost.data?.aiSpendByShop.data ?? []}
        loading={costLoading}
        windowLabel={windowLabel}
        plans={(plansQuery.data?.allPlans.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
        }))}
        planId={planId}
        onPlanChange={setPlanId}
      />
      <AiSpendByPlanCard
        rows={cost.data?.aiSpendByPlan.data ?? []}
        loading={costLoading}
        windowLabel={windowLabel}
      />
      <TopShopsCostCard
        rows={cost.data?.usageTopShops.data ?? []}
        loading={costLoading}
        windowLabel={windowLabel}
      />
      <TopProductsCard
        rows={products.data?.topProducts.data ?? []}
        loading={productsLoading}
      />
    </div>
  )
}
