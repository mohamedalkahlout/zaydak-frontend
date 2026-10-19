// Pure helpers for the "Sales by channel" section: which channel leads, how
// the ribbon splits, how the tiles sort and what the stacked chart plots.
// Nothing here formats for display or reads a locale — the components do that
// — so every rule the section relies on can be unit-tested on plain rows.

import {
  SALES_CHANNELS,
  isSalesChannel,
  type SalesChannel,
} from "@/shared/lib/sales-channels"
import type { SalesChannelRow, SalesTimePoint } from "../types"

/** What every figure, the ribbon and the chart in the section measure. */
export type ChannelMeasure = "sales" | "orders"

export function emptyChannelRow(channel: SalesChannel): SalesChannelRow {
  return {
    channel,
    orders_count: 0,
    total_sales_cents: 0,
    returns_cents: 0,
    average_order_value_cents: 0,
    customers_count: 0,
    share_bps: 0,
    previous_total_sales_cents: null,
    previous_orders_count: null,
    connected: true,
    series: [],
  }
}

/**
 * Exactly one row per known channel, in `SALES_CHANNELS` order.
 *
 * The API always sends all four, but the section must not depend on that: a
 * channel the client does not know yet is dropped rather than drawn without a
 * colour, and a missing one is zero-filled so the grid keeps its shape.
 */
export function normalizeChannelRows(
  rows: readonly SalesChannelRow[] | null | undefined,
): SalesChannelRow[] {
  const byChannel = new Map<SalesChannel, SalesChannelRow>()
  for (const row of rows ?? []) {
    if (isSalesChannel(row.channel) && !byChannel.has(row.channel)) {
      byChannel.set(row.channel, row)
    }
  }
  return SALES_CHANNELS.map(
    (channel) => byChannel.get(channel) ?? emptyChannelRow(channel),
  )
}

export function measureValue(
  row: SalesChannelRow,
  measure: ChannelMeasure,
): number {
  return measure === "sales" ? row.total_sales_cents : row.orders_count
}

/** The comparison figure, or null when the report was asked for none. */
export function previousMeasureValue(
  row: SalesChannelRow,
  measure: ChannelMeasure,
): number | null {
  return measure === "sales"
    ? row.previous_total_sales_cents
    : row.previous_orders_count
}

function pointValue(point: SalesTimePoint, measure: ChannelMeasure): number {
  return measure === "sales" ? point.total_sales_cents : point.orders_count
}

/** Nothing happened on this channel in the window: no orders, no refunds. */
export function isIdleChannel(row: SalesChannelRow): boolean {
  return (
    row.orders_count === 0 &&
    row.total_sales_cents === 0 &&
    row.returns_cents === 0
  )
}

/** The whole window is empty — the section shows its empty state. */
export function isEmptyChannelReport(
  rows: readonly SalesChannelRow[],
): boolean {
  return rows.every(isIdleChannel)
}

const rank = (channel: SalesChannel) => SALES_CHANNELS.indexOf(channel)

/**
 * Tile (and ribbon) order: by the selected measure, largest first, ties in
 * `SALES_CHANNELS` order; channels at zero go last in `SALES_CHANNELS` order,
 * so an empty channel never jumps around between periods.
 */
export function orderChannelRows(
  rows: readonly SalesChannelRow[],
  measure: ChannelMeasure,
): SalesChannelRow[] {
  const nonZero = rows
    .filter((row) => measureValue(row, measure) !== 0)
    .sort(
      (a, b) =>
        measureValue(b, measure) - measureValue(a, measure) ||
        rank(a.channel) - rank(b.channel),
    )
  const zero = rows
    .filter((row) => measureValue(row, measure) === 0)
    .sort((a, b) => rank(a.channel) - rank(b.channel))
  return [...nonZero, ...zero]
}

/**
 * Each channel's slice of the window, as a fraction of the positive total.
 *
 * The server's `share_bps` divides by the net total, so a channel whose
 * refunds outweigh its sales has a negative share and the others add up to
 * more than 100%. A ribbon cannot draw that, so a negative channel takes no
 * slice here and the rest are shares of what was actually sold. The headline,
 * the ribbon and the tiles all read this one split, so they always agree.
 */
export function channelShares(
  rows: readonly SalesChannelRow[],
  measure: ChannelMeasure,
): Record<SalesChannel, number> {
  const positive = rows.map((row) => Math.max(0, measureValue(row, measure)))
  const total = positive.reduce((sum, value) => sum + value, 0)
  const shares = Object.fromEntries(
    SALES_CHANNELS.map((channel) => [channel, 0]),
  ) as Record<SalesChannel, number>
  rows.forEach((row, i) => {
    shares[row.channel] = total > 0 ? positive[i] / total : 0
  })
  return shares
}

export type SharePercent =
  | { kind: "value"; percent: number }
  /** A real but sub-1% slice: shown as "under 1%", never as "0%". */
  | { kind: "below-one" }

/**
 * A share rounded to a whole percent for display. Two roundings are refused:
 * a slice that exists never reads "0%", and a leader that is not the only
 * channel never reads "100%" (99.6% of sales is not all of them).
 */
export function sharePercent(fraction: number): SharePercent {
  if (!(fraction > 0)) return { kind: "value", percent: 0 }
  let percent = Math.round(fraction * 100)
  if (percent === 0) return { kind: "below-one" }
  if (percent === 100 && fraction < 1) percent = 99
  return { kind: "value", percent }
}

export type ChannelHeadline =
  | { kind: "none" }
  | { kind: "all"; channel: SalesChannel }
  | { kind: "leader"; channel: SalesChannel; share: number }

/**
 * The sentence the section opens with: which channel led, and by how much.
 * "all" when one channel took every sale, "none" when nothing positive
 * happened in the window.
 */
export function pickHeadline(
  rows: readonly SalesChannelRow[],
  measure: ChannelMeasure,
): ChannelHeadline {
  const leader = orderChannelRows(rows, measure)[0]
  if (!leader || measureValue(leader, measure) <= 0) return { kind: "none" }
  const share = channelShares(rows, measure)[leader.channel]
  if (share >= 1) return { kind: "all", channel: leader.channel }
  return { kind: "leader", channel: leader.channel, share }
}

/** One chart bucket: its key plus the measure for every channel. */
export type ChannelPoint = { date: string } & Record<SalesChannel, number>

/**
 * The stacked chart's buckets. The union of every row's bucket keys (the API
 * pre-seeds empty buckets, but a row that arrives without them must not
 * shorten the axis), sorted — `YYYY-MM-DD` and `YYYY-MM` sort as strings.
 */
export function channelSeries(
  rows: readonly SalesChannelRow[],
  measure: ChannelMeasure,
): ChannelPoint[] {
  const dates = new Set<string>()
  const lookup = new Map<SalesChannel, Map<string, number>>()
  for (const row of rows) {
    const values = new Map<string, number>()
    for (const point of row.series) {
      dates.add(point.date)
      values.set(point.date, pointValue(point, measure))
    }
    lookup.set(row.channel, values)
  }
  return [...dates].sort().map((date) => {
    const point = { date } as ChannelPoint
    for (const channel of SALES_CHANNELS) {
      point[channel] = lookup.get(channel)?.get(date) ?? 0
    }
    return point
  })
}

/** True when a channel draws at least one non-zero bucket. */
export function channelHasSeries(
  points: readonly ChannelPoint[],
  channel: SalesChannel,
): boolean {
  return points.some((point) => point[channel] !== 0)
}

/**
 * The stacked chart's value range: the tallest positive stack and the deepest
 * negative one (a bucket whose refunds outweigh its sales), always spanning 0.
 */
export function stackExtent(points: readonly ChannelPoint[]): {
  min: number
  max: number
} {
  let min = 0
  let max = 0
  for (const point of points) {
    let up = 0
    let down = 0
    for (const channel of SALES_CHANNELS) {
      const value = point[channel]
      if (value > 0) up += value
      else down += value
    }
    max = Math.max(max, up)
    min = Math.min(min, down)
  }
  return { min, max }
}

/**
 * Round y-axis ticks covering `[min, max]`: a step of 1, 2 or 5 × 10ⁿ, about
 * `target` intervals, and never finer than `minStep`. The chart plots money in
 * cents, so it passes `minStep: 100` — every step is then a clean figure in
 * major units too (100, 200, 500 … cents → 1, 2, 5 … SAR) — and orders pass 1
 * so a count axis never shows a fraction. Replaces recharts' own ticks, which
 * divide the range evenly and land on values like 115 and 345.
 */
export function niceTicks(
  min: number,
  max: number,
  minStep = 1,
  target = 4,
): number[] {
  const hi0 = max > min ? max : min + minStep
  const rough = (hi0 - min) / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(
    minStep,
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
      10 * magnitude,
  )
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(hi0 / step) * step
  const ticks: number[] = []
  for (let i = 0; lo + i * step <= hi; i++) ticks.push(lo + i * step)
  return ticks
}

/**
 * Where a channel's segment sits in its bucket's stack, for the bar shape.
 *
 * recharts stacks positives upward and negatives downward in series order
 * (`stackOffset="sign"`), so among the channels sharing this value's sign the
 * first sits on the baseline and the last carries the data end — the one
 * corner that gets rounded. Every segment above the baseline leaves a gap
 * below it, which is what separates neighbours without drawing a border.
 */
export function segmentEdges(
  point: ChannelPoint,
  channel: SalesChannel,
): { isBase: boolean; isEnd: boolean } {
  const value = point[channel]
  if (value === 0) return { isBase: false, isEnd: false }
  const sameSign = SALES_CHANNELS.filter(
    (c) => Math.sign(point[c]) === Math.sign(value),
  )
  return {
    isBase: sameSign[0] === channel,
    isEnd: sameSign[sameSign.length - 1] === channel,
  }
}
