"use client"

import { useMemo, useState, type ReactNode } from "react"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { sectionUrl } from "@/features/settings/lib/routes"
import { Bones } from "@/shared/components/bones"
import {
  SALES_CHANNELS,
  SALES_CHANNEL_META,
  type SalesChannel,
} from "@/shared/lib/sales-channels"
import { cn } from "@/shared/lib/utils"
import type { SalesByChannelReport, SalesChannelRow } from "../../types"
import {
  channelSeries,
  channelShares,
  emptyChannelRow,
  isEmptyChannelReport,
  isIdleChannel,
  normalizeChannelRows,
  orderChannelRows,
  pickHeadline,
  type ChannelHeadline,
  type ChannelMeasure,
} from "../../lib/channel-mix"
import { EmptyRow } from "../card-states"
import { ChannelMixChart } from "./channel-mix-chart"
import { ChannelRibbon } from "./channel-ribbon"
import { ChannelTile, type ChannelTileAction } from "./channel-tile"
import { formatShare } from "./format"
import { MeasureToggle } from "./measure-toggle"

// Stable across renders: `<Bones>` re-runs its capture effect when this
// changes. `svg` as a leaf keeps a capture from tracing recharts' paths, and
// `.sr-only` is skipped: the chart's screen-reader table is clipped to 1px but
// its cells still measure, and the first capture drew them as 160 bones
// hundreds of pixels below the chart.
const SVG_LEAF = { leafTags: ["svg"], excludeSelectors: [".sr-only"] }

const PLACEHOLDER_ROWS = SALES_CHANNELS.map(emptyChannelRow)

/**
 * "Sales by channel": where the period's orders were placed — the online
 * store, the Telegram and WhatsApp assistants, or a draft the merchant
 * converted — split by sales or by orders.
 *
 * It opens on a sentence naming the leading channel, then the channel mix as
 * one ribbon, then a tile per channel, then the mix over time. Hovering a tile
 * or a ribbon segment highlights that channel in all three.
 *
 * Its data comes from its own query (`GET_SALES_BY_CHANNEL`), so this section
 * owns its failure: until the API serving the page knows `salesByChannel` it
 * shows an inline error with a retry, and the rest of the page is unaffected.
 */
export function SalesChannelsSection({
  report,
  loading,
  refreshing,
  error,
  onRetry,
  compare,
  shopSlug,
  className,
}: {
  /** The latest report, or the previous window's while a new one loads. */
  report: SalesByChannelReport | undefined
  /** A request is in flight. */
  loading: boolean
  /** `report` is being replaced — hold it, dimmed, rather than flash bones. */
  refreshing: boolean
  error: boolean
  onRetry: () => void
  compare: boolean
  shopSlug: string
  className?: string
}) {
  const t = useTranslations("analytics.salesChannels")
  const [measure, setMeasure] = useState<ChannelMeasure>("sales")
  const [focus, setFocus] = useState<SalesChannel | null>(null)

  const rows = useMemo(() => normalizeChannelRows(report?.rows), [report])
  const state: "error" | "loading" | "empty" | "ready" = error
    ? "error"
    : !report
      ? "loading"
      : isEmptyChannelReport(rows)
        ? "empty"
        : "ready"

  return (
    <Card className={cn("gap-5", className)}>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {t("subtitle")}
        </CardDescription>
        {state === "ready" || state === "loading" ? (
          <CardAction>
            <MeasureToggle
              value={measure}
              onChange={setMeasure}
              label={t("measure.aria")}
              labels={{
                sales: t("measure.sales"),
                orders: t("measure.orders"),
              }}
            />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {state === "error" ? (
          <ErrorState retrying={loading} onRetry={onRetry} />
        ) : state === "empty" ? (
          <div
            className={cn("transition-opacity", refreshing && "opacity-60")}
            aria-busy={refreshing || undefined}
          >
            <EmptyState />
          </div>
        ) : (
          <ChannelsBody
            rows={state === "loading" ? PLACEHOLDER_ROWS : rows}
            loading={state === "loading"}
            refreshing={refreshing}
            measure={measure}
            focus={focus}
            onFocusChange={setFocus}
            compare={compare}
            currency={report?.currency ?? "SAR"}
            granularity={report?.granularity ?? "day"}
            shopSlug={shopSlug}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ChannelsBody({
  rows,
  loading,
  refreshing,
  measure,
  focus,
  onFocusChange,
  compare,
  currency,
  granularity,
  shopSlug,
}: {
  rows: SalesChannelRow[]
  loading: boolean
  refreshing: boolean
  measure: ChannelMeasure
  focus: SalesChannel | null
  onFocusChange: (channel: SalesChannel | null) => void
  compare: boolean
  currency: string
  granularity: string
  shopSlug: string
}) {
  const t = useTranslations("analytics.salesChannels")
  const names = useTranslations("salesChannels")
  const locale = useLocale()

  const ordered = useMemo(
    () => orderChannelRows(rows, measure),
    [rows, measure],
  )
  const shares = useMemo(() => channelShares(rows, measure), [rows, measure])
  const points = useMemo(() => channelSeries(rows, measure), [rows, measure])
  const headline = pickHeadline(rows, measure)

  const share = (fraction: number) =>
    formatShare(fraction, locale, (s) => t("shareBelow", { share: s }))

  const ribbonLabel = t("ribbon", {
    measure,
    shares: new Intl.ListFormat(locale, { type: "unit" }).format(
      ordered.map((row) =>
        t("ribbonItem", {
          channel: names(`names.${row.channel}`),
          share: share(shares[row.channel]),
        }),
      ),
    ),
  })

  return (
    <div
      className={cn(
        "flex flex-col gap-5 transition-opacity duration-200",
        refreshing && "opacity-60",
        // Reserve roughly the settled height on a first paint, before any
        // bones have been measured, so the page below does not jump.
        loading && "min-h-[28rem]",
      )}
      aria-busy={loading || refreshing || undefined}
    >
      <Bones name="analytics-sales-channels-headline" loading={loading}>
        <div className="flex flex-col gap-3">
          <p
            aria-live="polite"
            className="font-heading text-lg leading-snug text-balance text-foreground/80 sm:text-xl"
          >
            <Headline headline={headline} measure={measure} share={share} />
          </p>
          <ChannelRibbon
            rows={ordered}
            shares={shares}
            label={ribbonLabel}
            focus={focus}
            onFocusChange={onFocusChange}
          />
        </div>
      </Bones>

      <Bones
        name="analytics-sales-channels-tiles"
        loading={loading}
        snapshotConfig={SVG_LEAF}
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ordered.map((row) => (
            <ChannelTile
              key={row.channel}
              row={row}
              measure={measure}
              share={shares[row.channel]}
              points={points}
              compare={compare}
              currency={currency}
              locale={locale}
              focused={focus === row.channel}
              onFocusChange={onFocusChange}
              action={tileAction(row, shopSlug, t)}
              placeholder={loading}
            />
          ))}
        </ul>
      </Bones>

      <Bones
        name="analytics-sales-channels-chart"
        loading={loading}
        snapshotConfig={SVG_LEAF}
      >
        <ChannelMixChart
          points={points}
          measure={measure}
          granularity={granularity}
          currency={currency}
          locale={locale}
          focus={focus}
        />
      </Bones>
    </div>
  )
}

function Headline({
  headline,
  measure,
  share,
}: {
  headline: ChannelHeadline
  measure: ChannelMeasure
  share: (fraction: number) => string
}) {
  const t = useTranslations("analytics.salesChannels")
  const names = useTranslations("salesChannels")

  if (headline.kind === "none") return <>{t("headline.none", { measure })}</>

  const meta = SALES_CHANNEL_META[headline.channel]
  const Icon = meta.icon
  // The channel reads as its own chip — the same tone as its tile's badge —
  // so the sentence and the tile below point at each other.
  const mark = (chunks: ReactNode) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-px align-baseline font-semibold",
        meta.tone,
      )}
    >
      <Icon className="size-[0.8em] shrink-0" aria-hidden />
      {chunks}
    </span>
  )
  const strong = (chunks: ReactNode) => (
    <span className="font-semibold text-foreground">{chunks}</span>
  )
  const channel = names(`names.${headline.channel}`)

  return headline.kind === "all"
    ? t.rich("headline.all", { channel, measure, mark })
    : t.rich("headline.leader", {
        channel,
        measure,
        share: share(headline.share),
        mark,
        strong,
      })
}

/**
 * The one next step a tile offers: connect a chat channel that is not live,
 * or open the drafts screen when no manual order was placed.
 */
function tileAction(
  row: SalesChannelRow,
  shopSlug: string,
  t: (key: string) => string,
): ChannelTileAction | null {
  if (
    (row.channel === "TELEGRAM" || row.channel === "WHATSAPP") &&
    !row.connected
  ) {
    return {
      href: sectionUrl(
        shopSlug,
        row.channel === "TELEGRAM" ? "telegram" : "whatsapp",
      ),
      label: t(`connect.${row.channel}`),
    }
  }
  if (row.channel === "DRAFT_ORDER" && isIdleChannel(row)) {
    return { href: `/store/${shopSlug}/orders/drafts`, label: t("drafts") }
  }
  return null
}

function EmptyState() {
  const t = useTranslations("analytics.salesChannels")
  return (
    <div className="flex flex-col items-center gap-1 pt-4">
      <div className="flex items-center gap-1.5" aria-hidden>
        {SALES_CHANNELS.map((channel) => {
          const meta = SALES_CHANNEL_META[channel]
          const Icon = meta.icon
          return (
            <span
              key={channel}
              className={cn(
                "flex size-7 items-center justify-center rounded-md opacity-70",
                meta.tone,
              )}
            >
              <Icon className="size-4" />
            </span>
          )
        })}
      </div>
      <EmptyRow label={t("empty")} />
    </div>
  )
}

function ErrorState({
  retrying,
  onRetry,
}: {
  retrying: boolean
  onRetry: () => void
}) {
  const t = useTranslations("analytics.salesChannels")
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center"
    >
      <TriangleAlertIcon className="size-5 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("error.title")}</p>
        <p className="text-xs text-muted-foreground">{t("error.body")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCwIcon
          className={cn(retrying && "animate-spin motion-reduce:animate-none")}
          aria-hidden
        />
        {t("error.retry")}
      </Button>
    </div>
  )
}
