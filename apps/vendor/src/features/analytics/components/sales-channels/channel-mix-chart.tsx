"use client"

import { useTranslations } from "next-intl"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMoneyCents } from "@/shared/lib/format"
import {
  SALES_CHANNELS,
  SALES_CHANNEL_META,
  type SalesChannel,
} from "@/shared/lib/sales-channels"
import {
  channelHasSeries,
  niceTicks,
  segmentEdges,
  stackExtent,
  type ChannelMeasure,
  type ChannelPoint,
} from "../../lib/channel-mix"
import { formatBucketLabel } from "../../lib/date-ranges"
import { formatAxisTick, formatCount } from "./format"

// Axis and tick styling follows SalesOverTimeCard (11px ticks, no tick or
// axis lines, 44px y-axis). The grid and tick colours are the theme tokens
// rather than its fixed slate hexes, so the hairlines stay one step off the
// card in dark mode too; the grid is solid rather than dashed.
const TICK = { fontSize: 11, fill: "var(--muted-foreground)" }
const GRID = "var(--border)"
/** Surface gap between stacked segments, and the data-end corner radius. */
const GAP = 2
const RADIUS = 4

/**
 * The channel mix per bucket: one stacked column per day (or month past 92
 * days), stacked in `SALES_CHANNELS` order so a channel keeps its place and
 * colour whatever the period. It follows the section's Sales / Orders switch.
 *
 * A refund-heavy bucket can go below zero; `stackOffset="sign"` stacks the
 * negative parts downward from the baseline instead of netting them into the
 * positive column.
 */
export function ChannelMixChart({
  points,
  measure,
  granularity,
  currency,
  locale,
  focus,
}: {
  points: ChannelPoint[]
  measure: ChannelMeasure
  granularity: string
  currency: string
  locale: string
  focus: SalesChannel | null
}) {
  const t = useTranslations("analytics.salesChannels")
  const names = useTranslations("salesChannels")
  const drawn = SALES_CHANNELS.filter((channel) =>
    channelHasSeries(points, channel),
  )
  const format = (value: number) =>
    measure === "sales"
      ? formatMoneyCents(value, currency, locale)
      : formatCount(value, locale)
  const extent = stackExtent(points)
  const ticks = niceTicks(extent.min, extent.max, measure === "sales" ? 100 : 1)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-medium">{t("chart.title")}</h3>
        {/* Legend: always present with the chart, one key per channel drawn,
            in stack order. Rect keys, because the marks are bars. */}
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {drawn.map((channel) => (
            <li key={channel} className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: SALES_CHANNEL_META[channel].color }}
                aria-hidden
              />
              {names(`names.${channel}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            stackOffset="sign"
            barCategoryGap="20%"
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={TICK}
              tickFormatter={(date: string) =>
                formatBucketLabel(date, granularity, locale)
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
              tick={TICK}
              tickFormatter={(value: number) =>
                formatAxisTick(value, measure, locale)
              }
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={
                <ChannelTooltip
                  granularity={granularity}
                  locale={locale}
                  format={format}
                  channelName={(channel) => names(`names.${channel}`)}
                  totalLabel={t("chart.total")}
                />
              }
            />
            {SALES_CHANNELS.map((channel) => {
              const color = SALES_CHANNEL_META[channel].color
              // A channel highlighted from its tile keeps full ink; the rest
              // step back so its column segments read against them.
              const opacity = focus && focus !== channel ? 0.25 : 1
              return (
                <Bar
                  key={channel}
                  dataKey={channel}
                  stackId="channels"
                  maxBarSize={24}
                  fill={color}
                  isAnimationActive={false}
                  shape={(props: unknown) => (
                    <SegmentShape
                      {...(props as SegmentShapeProps)}
                      channel={channel}
                      fill={color}
                      fillOpacity={opacity}
                    />
                  )}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* The chart's table twin, for screen readers: every value the tooltip
          shows, reachable without a pointer. `sr-only` sits on a wrapper, not
          the table: a table ignores the 1px width and would widen the page
          on a phone. */}
      <div className="sr-only">
        <table>
          <caption>{t("chart.table", { measure })}</caption>
          <thead>
            <tr>
              <th scope="col">{t("chart.period")}</th>
              {SALES_CHANNELS.map((channel) => (
                <th key={channel} scope="col">
                  {names(`names.${channel}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <th scope="row">
                  {formatBucketLabel(point.date, granularity, locale)}
                </th>
                {SALES_CHANNELS.map((channel) => (
                  <td key={channel}>{format(point[channel])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface SegmentShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  fillOpacity?: number
  payload?: ChannelPoint
}

/**
 * One stacked segment. The baseline segment of each sign sits flush on zero;
 * every other one gives up `GAP` px on its baseline side, which leaves a strip
 * of card showing between neighbours. Only the segment carrying the data end
 * (the top of the positive stack, the bottom of the negative one) is rounded.
 */
function SegmentShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  fillOpacity,
  payload,
  channel,
}: SegmentShapeProps & { channel: SalesChannel }) {
  if (!payload || !width || !height) return null
  const value = payload[channel]
  if (!value) return null

  const { isBase, isEnd } = segmentEdges(payload, channel)
  const top = Math.min(y, y + height)
  const bottom = Math.max(y, y + height)
  const positive = value > 0

  // Trim the gap on the side facing the baseline (below a positive segment,
  // above a negative one), but never below 1px of visible mark.
  let y0 = top
  let y1 = bottom
  if (!isBase) {
    if (positive) y1 = Math.max(y0 + 1, y1 - GAP)
    else y0 = Math.min(y1 - 1, y0 + GAP)
  }
  const h = y1 - y0
  const r = isEnd ? Math.min(RADIUS, h, width / 2) : 0

  if (r === 0) {
    return (
      <rect
        x={x}
        y={y0}
        width={width}
        height={h}
        fill={fill}
        fillOpacity={fillOpacity}
      />
    )
  }

  const x1 = x + width
  const d = positive
    ? // Rounded top corners, square at the baseline side.
      `M${x},${y1} L${x},${y0 + r} Q${x},${y0} ${x + r},${y0} L${x1 - r},${y0} Q${x1},${y0} ${x1},${y0 + r} L${x1},${y1} Z`
    : // Rounded bottom corners.
      `M${x},${y0} L${x1},${y0} L${x1},${y1 - r} Q${x1},${y1} ${x1 - r},${y1} L${x + r},${y1} Q${x},${y1} ${x},${y1 - r} Z`
  return <path d={d} fill={fill} fillOpacity={fillOpacity} />
}

interface TooltipContentProps {
  active?: boolean
  payload?: Array<{ payload?: ChannelPoint }>
  granularity: string
  locale: string
  format: (value: number) => string
  channelName: (channel: SalesChannel) => string
  totalLabel: string
}

/**
 * Every channel at the hovered bucket, in stack order, then the total. The
 * value leads (strong, right-aligned) and the name follows, keyed by a short
 * stroke of the channel's colour.
 */
function ChannelTooltip({
  active,
  payload,
  granularity,
  locale,
  format,
  channelName,
  totalLabel,
}: TooltipContentProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const total = SALES_CHANNELS.reduce((sum, c) => sum + point[c], 0)

  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">
        {formatBucketLabel(point.date, granularity, locale)}
      </p>
      <ul className="flex flex-col gap-1">
        {SALES_CHANNELS.map((channel) => (
          <li
            key={channel}
            className="flex items-center justify-between gap-4 tabular-nums"
          >
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-0.5 w-2.5 rounded-full"
                style={{ backgroundColor: SALES_CHANNEL_META[channel].color }}
                aria-hidden
              />
              {channelName(channel)}
            </span>
            <span className="font-medium text-foreground">
              {format(point[channel])}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-center justify-between gap-4 border-t border-border pt-1.5 tabular-nums">
        <span className="text-muted-foreground">{totalLabel}</span>
        <span className="font-semibold text-foreground">{format(total)}</span>
      </p>
    </div>
  )
}
