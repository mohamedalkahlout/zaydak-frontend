"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import {
  GoalIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format";
import { AutoscaleInput } from "@repo/ui/components/autoscale-input";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { downloadCsv, toCsvSections } from "@/shared/lib/csv";
import { TargetCreateDialog, type Target } from "@/features/targets";
import { InsightsCard } from "@/features/insights";
import {
  GET_ANALYTICS_OVERVIEW,
  GET_ANALYTICS_SECONDARY,
  GET_SALES_BY_CHANNEL,
} from "../api";
import type {
  AnalyticsOverviewResponse,
  AnalyticsSecondaryResponse,
  SalesByChannelResponse,
} from "../types";
import {
  rangeForCustom,
  rangeForPreset,
  type DateRange,
  type RangePreset,
} from "../lib/date-ranges";
import { computeDelta, formatBps } from "../lib/metrics";
import { isSchemaMismatchError } from "../lib/schema-mismatch";
import { AnalyticsDateRange } from "./analytics-date-range";
import { AnalyticsComparison } from "./analytics-comparison";
import { AnalyticsCurrency } from "./analytics-currency";
import { AnalyticsTargetsSection } from "./analytics-targets-section";
import { MetricCard } from "./metric-card";
import { SalesOverTimeCard } from "./sales-over-time-card";
import { SalesBreakdownCard } from "./sales-breakdown-card";
import { AovOverTimeCard } from "./aov-over-time-card";
import { TopProductsCard } from "./top-products-card";
import { SellThroughCard } from "./sell-through-card";
import { CohortMiniCard } from "./cohort-mini-card";
import { TopCustomersCard } from "./top-customers-card";
import { SalesByChannelCard } from "./sales-by-channel-card";
import { OrdersByStatusCard } from "./orders-by-status-card";
import { LowStockCard } from "./low-stock-card";
import { CategorySalesCard } from "./category-sales-card";
import { SalesChannelsSection } from "./sales-channels/sales-channels-section";

// null = closed, "new" = create, otherwise the target being edited.
type TargetDialogState =
  | { mode: "new"; suggestion?: number }
  | { mode: "edit"; target: Target }
  | null;

export function AnalyticsOverview() {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const [preset, setPreset] = useState<RangePreset | "custom">("last_30_days");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [compare, setCompare] = useState(true);
  const [targetDialog, setTargetDialog] = useState<TargetDialogState>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [seenData, setSeenData] = useState<unknown>(null);

  // Recomputed only when the selection changes. Sent as ISO strings — Apollo
  // does not serialize Date objects for the DateTime scalar. `customRange` is
  // already a resolved half-open window (rangeForCustom ran at pick time), so
  // it is used as-is here. `range` is also handed to the date filter so its
  // label always matches the exact window the queries ran with.
  const dateWindow = useMemo(() => {
    const range =
      preset === "custom" && customRange
        ? customRange
        : rangeForPreset(preset === "custom" ? "last_30_days" : preset);
    return {
      range,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    };
  }, [preset, customRange]);

  // Two round trips, grouped by lifecycle: the OVERVIEW query holds everything
  // that changes with the date range (salesReport + topProducts) and refetches
  // when it does; the SECONDARY query holds the range-independent widgets
  // (current stock state + all-time aggregates) and is fetched once. GraphQL
  // resolves each query's fields server-side in one request — so the five cards
  // cost two requests, not five, without refetching static data on every range
  // change.
  const overview = useQuery<AnalyticsOverviewResponse>(GET_ANALYTICS_OVERVIEW, {
    variables: {
      input: { start: dateWindow.start, end: dateWindow.end, compare },
      limit: 6,
      start: dateWindow.start,
      end: dateWindow.end,
      caInput: {
        start: dateWindow.start,
        end: dateWindow.end,
        cohortMonths: 8,
        topLimit: 6,
      },
      attrInput: {
        start: dateWindow.start,
        end: dateWindow.end,
        groupBy: "CHANNEL",
      },
    },
    fetchPolicy: "cache-and-network",
  });
  const secondary = useQuery<AnalyticsSecondaryResponse>(
    GET_ANALYTICS_SECONDARY,
    { variables: { threshold: 10 }, fetchPolicy: "cache-and-network" },
  );
  // Sales by channel, same window and comparison as the overview but its own
  // request: an API that does not know `salesByChannel` rejects the whole
  // document, so folding it into AnalyticsOverview would blank every card on
  // the page. Kept apart, the section renders its own error and retry, or is
  // left out on an API that does not have the field yet.
  // `silentErrors` because it does: the error link would otherwise log it on
  // every visit (its VALIDATION_ERROR code already suppresses the toast).
  const channels = useQuery<SalesByChannelResponse>(GET_SALES_BY_CHANNEL, {
    variables: {
      input: { start: dateWindow.start, end: dateWindow.end, compare },
    },
    fetchPolicy: "cache-and-network",
    context: { silentErrors: true },
  });
  // Across a range change `data` is empty until the new window lands; the
  // previous window's report is held (dimmed) instead of flashing skeletons.
  const channelReport =
    channels.data?.salesByChannel?.data ??
    channels.previousData?.salesByChannel?.data;
  // An API older than this dashboard does not know `salesByChannel` at all.
  // That refusal is permanent until the API is rebuilt, so the section is left
  // out rather than shown as an error whose "try again" can never work.
  const channelsUnsupported = isSchemaMismatchError(channels.error);

  const report = overview.data?.salesReport?.data;
  const current = report?.current;
  const previous = compare ? (report?.previous ?? null) : null;
  const reportLoading = overview.loading && !report;
  // The report echoes the shop's currency (order snapshot); money formats with it.
  const currency = report?.currency ?? "SAR";

  // Stamp the "last refreshed" clock whenever a fresh result lands. Done with
  // the "adjust state during render" pattern (guarded by a reference change),
  // not an effect: server render sees no data → clock stays null, so there is
  // no hydration mismatch from a live timestamp.
  if (overview.data && overview.data !== seenData) {
    setSeenData(overview.data);
    setLastRefreshed(new Date());
  }

  const delta = (pick: (b: NonNullable<typeof current>) => number) =>
    compare && current
      ? computeDelta(pick(current), previous ? pick(previous) : null)
      : null;

  const onExport = () => {
    if (!current) return;
    const money = (c: number) => formatMoneyCents(c, currency);
    const rows = [
      {
        Metric: t("breakdown.gross_sales_cents"),
        Value: money(current.gross_sales_cents),
      },
      {
        Metric: t("breakdown.discounts_cents"),
        Value: money(current.discounts_cents),
      },
      {
        Metric: t("breakdown.returns_cents"),
        Value: money(current.returns_cents),
      },
      {
        Metric: t("breakdown.net_sales_cents"),
        Value: money(current.net_sales_cents),
      },
      {
        Metric: t("breakdown.shipping_cents"),
        Value: money(current.shipping_cents),
      },
      { Metric: t("breakdown.taxes_cents"), Value: money(current.taxes_cents) },
      {
        Metric: t("breakdown.total_sales_cents"),
        Value: money(current.total_sales_cents),
      },
      { Metric: t("breakdown.cogs_cents"), Value: money(current.cogs_cents) },
      {
        Metric: t("breakdown.gross_profit_cents"),
        Value: money(current.gross_profit_cents),
      },
      { Metric: t("breakdown.fees_cents"), Value: money(current.fees_cents) },
      {
        Metric: t("breakdown.net_profit_cents"),
        Value: money(current.net_profit_cents),
      },
      {
        Metric: t("breakdown.margin"),
        Value: `${bpsToPercent(current.margin_bps).toFixed(1)}%`,
      },
      {
        Metric: t("breakdown.return_fees_cents"),
        Value: money(current.return_fees_cents),
      },
      { Metric: t("kpi.orders"), Value: String(current.orders_count) },
      {
        Metric: t("kpi.fulfilled"),
        Value: String(current.fulfilled_orders_count),
      },
      {
        Metric: t("kpi.avgOrderValue"),
        Value: money(current.average_order_value_cents),
      },
      {
        Metric: t("kpi.returningRate"),
        Value: `${bpsToPercent(current.returning_customer_rate_bps).toFixed(1)}%`,
      },
    ];
    const csv = toCsvSections([{ title: t("breakdown.title"), rows }]);
    downloadCsv(
      `analytics-${report?.start?.slice(0, 10) ?? "report"}.csv`,
      csv,
    );
  };

  // The section shows its own error, so a failed refetch has nothing left to
  // report — swallowed here rather than left as an unhandled rejection.
  const refetchChannels = () => {
    channels.refetch().catch(() => {});
  };

  const onRefresh = () => {
    void overview.refetch();
    void secondary.refetch();
    refetchChannels();
  };

  // A suggested goal for the "Suggested targets" entry point: 10% above the
  // current period's total sales, rounded to a clean figure.
  const suggestedAmount = current
    ? Math.max(
        100,
        Math.ceil(((current.total_sales_cents / 100) * 1.1) / 100) * 100,
      )
    : undefined;

  // The headline figure gets the auto-scaling hero treatment: the currency is
  // pulled out as a prefix and the amount is grouped for the locale so the type
  // can shrink to fit the card as the number of digits grows.
  const totalSalesAmount = current
    ? new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(current.total_sales_cents / 100)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          {lastRefreshed ? (
            <span className="text-xs text-muted-foreground">
              {t("lastRefreshed", {
                time: lastRefreshed.toLocaleTimeString(locale, {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="outline"
                  size="icon"
                  aria-label={t("moreActions")}
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRefresh}>
                <RefreshCwIcon className="size-4" />
                {t("refresh")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport} disabled={!current}>
                {t("export")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button {...props} variant="outline">
                  <GoalIcon className="size-4" />
                  {t("targets.button")}
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setTargetDialog({ mode: "new" })}
              >
                {t("targets.add")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setTargetDialog({ mode: "new", suggestion: suggestedAmount })
                }
              >
                {t("targets.suggested")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={(props) => (
                  <Link
                    {...props}
                    href={`/store/${shopSlug}/analytics/targets`}
                  >
                    {t("targets.viewAll")}
                  </Link>
                )}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            nativeButton={false}
            render={<Link href={`/store/${shopSlug}/analytics/reports`} />}
          >
            <PlusIcon className="size-4" />
            {t("newExploration")}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <AnalyticsDateRange
          preset={preset}
          onPresetChange={setPreset}
          effectiveRange={dateWindow.range}
          onCustomRange={(range) => {
            setCustomRange(rangeForCustom(range));
            setPreset("custom");
          }}
        />
        <AnalyticsComparison
          compare={compare}
          onCompareChange={setCompare}
          effectiveRange={dateWindow.range}
        />
        <AnalyticsCurrency currency={currency} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("kpi.totalSales")}
          value={formatMoneyCents(current?.total_sales_cents, currency)}
          valueContent={
            totalSalesAmount != null ? (
              <AutoscaleInput
                readOnly
                tabIndex={-1}
                numberFormat="string"
                value={totalSalesAmount}
                prefix={currency}
                minSize={14}
                maxSize={32}
                aria-label={t("kpi.totalSales")}
                containerClassName="min-w-0 flex-1 font-heading font-semibold text-foreground"
                wrapperClassName="justify-start"
                className="cursor-default"
              />
            ) : undefined
          }
          delta={delta((b) => b.total_sales_cents)}
          loading={reportLoading}
          // Its figure is an AutoscaleInput, not the plain heading span every
          // other KPI renders, so it gets its own capture.
          boneName="analytics-kpi-total-sales"
        />
        <MetricCard
          label={t("kpi.orders")}
          value={(current?.orders_count ?? 0).toLocaleString()}
          delta={delta((b) => b.orders_count)}
          loading={reportLoading}
        />
        <MetricCard
          label={t("kpi.fulfilled")}
          value={(current?.fulfilled_orders_count ?? 0).toLocaleString()}
          delta={delta((b) => b.fulfilled_orders_count)}
          loading={reportLoading}
        />
        <MetricCard
          label={t("kpi.returningRate")}
          value={formatBps(current?.returning_customer_rate_bps)}
          delta={delta((b) => b.returning_customer_rate_bps)}
          loading={reportLoading}
        />
      </div>

      {channelsUnsupported ? null : (
        <SalesChannelsSection
          report={channelReport}
          loading={channels.loading}
          refreshing={channels.loading && channelReport != null}
          error={channels.error != null}
          onRetry={refetchChannels}
          compare={compare}
          shopSlug={shopSlug}
        />
      )}

      <InsightsCard />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SalesOverTimeCard
          className="lg:col-span-2"
          report={report}
          loading={reportLoading}
          compare={compare}
          currency={currency}
        />
        <SalesBreakdownCard
          breakdown={current}
          loading={reportLoading}
          currency={currency}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AovOverTimeCard
          report={report}
          loading={reportLoading}
          compare={compare}
          currency={currency}
        />
        <SalesByChannelCard
          report={overview.data?.attributionReport?.data}
          loading={overview.loading && !overview.data}
          viewHref={`/store/${shopSlug}/analytics/attribution`}
        />
        <SellThroughCard
          products={overview.data?.sellThroughProducts?.data}
          loading={overview.loading && !overview.data}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CohortMiniCard
          className="lg:col-span-2"
          cohorts={overview.data?.customerAnalytics?.data?.cohorts}
          loading={overview.loading && !overview.data}
          viewHref={`/store/${shopSlug}/analytics/customers`}
        />
        <TopCustomersCard
          customers={overview.data?.customerAnalytics?.data?.top_customers}
          loading={overview.loading && !overview.data}
          currency={
            overview.data?.customerAnalytics?.data?.currency ?? currency
          }
          viewHref={`/store/${shopSlug}/analytics/customers`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopProductsCard
          products={overview.data?.topProducts?.data}
          loading={overview.loading && !overview.data}
          currency={currency}
        />
        <OrdersByStatusCard
          data={secondary.data?.ordersByStatus?.data}
          loading={secondary.loading && !secondary.data}
        />
        <LowStockCard
          products={secondary.data?.lowStockProducts?.data}
          loading={secondary.loading && !secondary.data}
        />
        <CategorySalesCard
          categories={secondary.data?.categorySales?.data}
          loading={secondary.loading && !secondary.data}
        />
      </div>

      <AnalyticsTargetsSection
        onEdit={(target) => setTargetDialog({ mode: "edit", target })}
      />

      {/* Always mounted (open toggles) so the drawer can play its open/close
          slide animation — base-ui only transitions a mounted popup. */}
      <TargetCreateDialog
        target={targetDialog?.mode === "edit" ? targetDialog.target : undefined}
        suggestion={
          targetDialog?.mode === "new" ? targetDialog.suggestion : undefined
        }
        currency={currency}
        open={targetDialog !== null}
        onOpenChange={(open) => {
          if (!open) setTargetDialog(null);
        }}
        onDone={() => setTargetDialog(null)}
      />
    </div>
  );
}
