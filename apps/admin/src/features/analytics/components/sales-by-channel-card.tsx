"use client"

import { useLocale, useTranslations } from "next-intl"
import { RefreshCwIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { cn } from "@repo/ui/lib/utils"
import { Bones } from "@/shared/components/bones"
import { formatAmountCents } from "@/shared/lib/format"
import type { SalesByChannelData } from "../types"
import { barShare } from "../lib/analytics"
import {
  SALES_CHANNEL_META,
  channelShares,
  formatChange,
  formatShare,
  isIdleChannel,
  normalizeChannelRows,
  orderChannelRows,
  salesChange,
  type ChannelFigures,
  type SalesChannel,
} from "../lib/sales-channels"
import { AnalyticsPanel } from "./panel"

/**
 * Sales across the marketplace, split by where each order was placed: the
 * storefronts, the shops' Telegram and WhatsApp assistants, or a draft a
 * merchant converted.
 *
 * The vendor dashboard draws the same report with recharts; this console ships
 * none, so it is CSS: one share ribbon, then a row per channel with its bar,
 * sales, share, orders, customers and the change on the previous window of the
 * same length. Shares are of the positive total (a channel whose refunds
 * outweigh its sales takes no slice), which is what the vendor side shows too.
 *
 * Amounts are currency-less like everything else on this screen: the report
 * sums every shop's orders, and the platform has no single currency to stamp
 * on them.
 */
export function SalesByChannelCard({
  report,
  loading,
  refreshing,
  error,
  onRetry,
  days,
  windows,
  onDaysChange,
}: {
  report: SalesByChannelData | undefined
  /** First load: nothing to show yet. */
  loading: boolean
  /** A new window is loading over the previous one's figures. */
  refreshing: boolean
  error: boolean
  onRetry: () => void
  days: number
  windows: readonly number[]
  onDaysChange: (days: number) => void
}) {
  const t = useTranslations("analytics")
  const windowLabel = t("window.lastDays", { days })

  return (
    <AnalyticsPanel
      title={t("salesByChannel.title")}
      description={t("salesByChannel.subtitle", { window: windowLabel })}
      action={
        <Select
          value={String(days)}
          // `Number(null)` is 0, which would ask for a zero-day window.
          onValueChange={(value) => {
            if (value) onDaysChange(Number(value))
          }}
        >
          <SelectTrigger className="w-36" aria-label={t("window.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {windows.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {t("window.lastDays", { days: option })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {error && !report ? (
        <div
          role="status"
          className="flex flex-col items-center gap-3 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            {t("salesByChannel.error")}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon aria-hidden />
            {t("salesByChannel.retry")}
          </Button>
        </div>
      ) : (
        <Bones name="admin-sales-by-channel" loading={loading}>
          <div
            className={cn(
              "transition-opacity duration-200",
              refreshing && "opacity-60",
            )}
            aria-busy={refreshing || undefined}
          >
            {report ? <ChannelsBody report={report} /> : null}
          </div>
        </Bones>
      )}
    </AnalyticsPanel>
  )
}

function ChannelsBody({ report }: { report: SalesByChannelData }) {
  const t = useTranslations("analytics.salesByChannel")
  const locale = useLocale()

  const rows = normalizeChannelRows(report.rows)
  if (rows.every(isIdleChannel)) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    )
  }

  const ordered = orderChannelRows(rows)
  const shares = channelShares(rows)
  const share = (fraction: number) =>
    formatShare(fraction, locale, (s) => t("shareBelow", { share: s }))
  const name = (channel: SalesChannel) => t(`channels.${channel}`)
  const ribbonLabel = t("ribbon", {
    shares: new Intl.ListFormat(locale, { type: "unit" }).format(
      ordered.map((row) =>
        t("ribbonItem", {
          channel: name(row.channel),
          share: share(shares[row.channel]),
        }),
      ),
    ),
  })
  const segments = ordered.filter((row) => shares[row.channel] > 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t.rich("total", {
          amount: formatAmountCents(report.total_sales_cents, locale),
          orders: report.orders_count,
          strong: (chunks) => (
            <span className="font-heading text-lg font-semibold text-foreground tabular-nums">
              {chunks}
            </span>
          ),
        })}
      </p>

      {/* The mix as one bar. A flex row, so it reads right to left in Arabic
          with nothing to mirror; the rows below carry every number, so the
          segments stay presentational behind one spoken summary. */}
      <div
        role="img"
        aria-label={ribbonLabel}
        className={cn(
          "flex h-3 w-full gap-[2px] overflow-hidden rounded-full",
          segments.length === 0 && "bg-muted",
        )}
      >
        {segments.map((row) => (
          <div
            key={row.channel}
            data-channel={row.channel}
            className="h-full min-w-1.5 basis-0 rounded-[3px]"
            style={{
              flexGrow: shares[row.channel],
              backgroundColor: SALES_CHANNEL_META[row.channel].color,
            }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {ordered.map((row) => (
          <ChannelRow
            key={row.channel}
            row={row}
            name={name(row.channel)}
            share={share(shares[row.channel])}
            fraction={shares[row.channel]}
          />
        ))}
      </ul>
    </div>
  )
}

function ChannelRow({
  row,
  name,
  share,
  fraction,
}: {
  row: ChannelFigures
  name: string
  share: string
  fraction: number
}) {
  const t = useTranslations("analytics.salesByChannel")
  const locale = useLocale()
  const meta = SALES_CHANNEL_META[row.channel]
  const Icon = meta.icon
  const change = salesChange(row)

  return (
    <li className="flex flex-col gap-1.5" data-channel={row.channel}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md",
              meta.tone,
            )}
            aria-hidden
          >
            <Icon className="size-3.5" />
          </span>
          <span className="truncate">{name}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
          <span className="font-medium">
            {formatAmountCents(row.total_sales_cents, locale)}
          </span>
          <span className="w-16 text-end text-xs text-muted-foreground">
            {share}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${barShare(fraction, 1)}%`,
            backgroundColor: meta.color,
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {t("orders", { count: row.orders_count })}
          {" · "}
          {t("customers", { count: row.customers_count })}
        </span>
        {change != null ? (
          <span
            className={cn(
              "tabular-nums",
              change > 0 && "text-emerald-600 dark:text-emerald-400",
              change < 0 && "text-red-600 dark:text-red-400",
            )}
          >
            {t("change", { change: formatChange(change, locale) })}
          </span>
        ) : null}
      </div>
    </li>
  )
}

