"use client"

import type { CSSProperties, PointerEvent } from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import { formatMoneyCents } from "@/shared/lib/format"
import {
  SALES_CHANNEL_META,
  type SalesChannel,
} from "@/shared/lib/sales-channels"
import { cn } from "@/shared/lib/utils"
import type { SalesChannelRow } from "../../types"
import {
  isIdleChannel,
  measureValue,
  previousMeasureValue,
  type ChannelMeasure,
  type ChannelPoint,
} from "../../lib/channel-mix"
import { computeDelta } from "../../lib/metrics"
import { DeltaBadge } from "../delta-badge"
import { formatCount, formatShare } from "./format"

export interface ChannelTileAction {
  href: string
  label: string
}

/**
 * One channel's figures: its identity, the selected measure as the big number
 * (with the period-over-period change when comparing), the supporting counts,
 * its share, and a sparkline of the same measure over the window.
 *
 * A channel with nothing in the window — no orders, no refunds — draws a quiet
 * tile that says what the channel is instead of a row of zeros, plus the one
 * thing the merchant can do about it (connect the bot, create a draft).
 */
export function ChannelTile({
  row,
  measure,
  share,
  points,
  compare,
  currency,
  locale,
  focused,
  onFocusChange,
  action,
  placeholder = false,
}: {
  row: SalesChannelRow
  measure: ChannelMeasure
  /** Fraction of the positive total, from `channelShares`. */
  share: number
  /** The section's buckets; the sparkline reads this channel's column. */
  points: readonly ChannelPoint[]
  compare: boolean
  currency: string
  locale: string
  focused: boolean
  onFocusChange: (channel: SalesChannel | null) => void
  action: ChannelTileAction | null
  /** Loading shape: an active tile with no figures, for the skeleton. */
  placeholder?: boolean
}) {
  const t = useTranslations("analytics.salesChannels")
  const names = useTranslations("salesChannels")
  const meta = SALES_CHANNEL_META[row.channel]
  const Icon = meta.icon
  const idle = !placeholder && isIdleChannel(row)
  const money = (cents: number) => formatMoneyCents(cents, currency, locale)

  const value = measureValue(row, measure)
  const previous = previousMeasureValue(row, measure)
  const delta =
    compare && !placeholder && previous != null
      ? computeDelta(value, previous)
      : null

  const figure = placeholder
    ? "—"
    : measure === "sales"
      ? money(row.total_sales_cents)
      : formatCount(row.orders_count, locale)

  const facts = placeholder
    ? []
    : [
        measure === "sales"
          ? t("orders", { count: row.orders_count })
          : t("salesAmount", { amount: money(row.total_sales_cents) }),
        ...(row.orders_count > 0
          ? [t("aov", { amount: money(row.average_order_value_cents) })]
          : []),
        // A manual order need not name a customer, so a channel can have
        // orders and none; "0 customers" there would read as an error.
        ...(row.customers_count > 0
          ? [t("customers", { count: row.customers_count })]
          : []),
      ]

  const hover =
    (channel: SalesChannel | null) => (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") onFocusChange(channel)
    }

  return (
    <li
      data-channel={row.channel}
      data-focused={focused || undefined}
      data-idle={idle || undefined}
      onPointerEnter={hover(row.channel)}
      onPointerLeave={hover(null)}
      onFocus={() => onFocusChange(row.channel)}
      onBlur={() => onFocusChange(null)}
      style={{ "--channel": meta.color } as CSSProperties}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/5 transition-[box-shadow,background-color] duration-200",
        idle ? "bg-muted/25" : "bg-muted/50",
        "data-focused:ring-2 data-focused:ring-(--channel)/70",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            meta.tone,
            idle && "opacity-60",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium",
            idle && "text-muted-foreground",
          )}
        >
          {names(`names.${row.channel}`)}
        </span>
        {!idle && !placeholder ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {/* The legend key: the exact fill the ribbon and chart use. */}
            <span
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            {t("share", {
              share: formatShare(share, locale, (s) =>
                t("shareBelow", { share: s }),
              ),
              measure,
            })}
          </span>
        ) : null}
      </div>

      {idle ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {names(`descriptions.${row.channel}`)}
        </p>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 font-heading text-xl font-semibold break-words sm:text-2xl">
              {figure}
            </span>
            {delta ? <DeltaBadge delta={delta} /> : null}
          </div>
          <p className="min-h-4 text-xs text-muted-foreground">
            {facts.join(" · ")}
          </p>
          {points.length > 1 ? (
            <ChannelSparkline points={points} channel={row.channel} />
          ) : placeholder ? (
            // Keeps a loading tile the height of a real one, so measured
            // bones are not stretched to fit it.
            <div className="h-10" aria-hidden />
          ) : null}
        </>
      )}

      {action && !placeholder ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {!row.connected ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-1.5 rounded-full bg-muted-foreground/50"
                aria-hidden
              />
              {t("notConnected")}
            </span>
          ) : null}
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 rounded-sm font-medium text-teal-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-teal-400"
          >
            {action.label}
            <ArrowRightIcon className="size-3 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      ) : null}
    </li>
  )
}

/**
 * The channel's measure across the window, drawn in its colour: a 2px line
 * over a 12% wash, no axes, zero-anchored so a flat channel reads as flat
 * rather than as noise stretched to fill the box. Decorative — the chart
 * below carries the same numbers with axes and a tooltip.
 */
function ChannelSparkline({
  points,
  channel,
}: {
  points: readonly ChannelPoint[]
  channel: SalesChannel
}) {
  const color = SALES_CHANNEL_META[channel].color
  const data = points.map((point) => ({
    date: point.date,
    value: point[channel],
  }))
  return (
    <div className="h-10 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, right: 1, bottom: 1, left: 1 }}
        >
          <YAxis
            hide
            domain={[
              (min: number) => Math.min(0, min),
              (max: number) => Math.max(0, max),
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={color}
            fillOpacity={0.12}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
