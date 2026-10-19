import {
  ClipboardPenIcon,
  MessageCircleIcon,
  SendIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * Where an order was placed, as the back-end's `SalesChannel` enum names it:
 * the storefront, a shop's Telegram or WhatsApp assistant (`placed_via`), or
 * a draft order a merchant converted.
 *
 * **A mirror of `apps/vendor/src/shared/lib/sales-channels.ts`** — the console
 * cannot import vendor code. Keep the order, the icons and the four hexes in
 * step with it, so a channel reads the same on both consoles. The order is the
 * display order wherever a list is not sorted by value.
 */
export const SALES_CHANNELS = [
  "ONLINE_STORE",
  "TELEGRAM",
  "WHATSAPP",
  "DRAFT_ORDER",
] as const

export type SalesChannel = (typeof SALES_CHANNELS)[number]

export function isSalesChannel(value: unknown): value is SalesChannel {
  return (
    typeof value === "string" &&
    (SALES_CHANNELS as readonly string[]).includes(value)
  )
}

/**
 * One identity per channel. The hexes are the Tailwind -600 steps of violet,
 * sky, emerald and orange, validated in the vendor app as a categorical set
 * against both the light and the dark card; `tone` is the icon-badge classes.
 */
export const SALES_CHANNEL_META: Record<
  SalesChannel,
  { icon: LucideIcon; color: string; tone: string }
> = {
  ONLINE_STORE: {
    icon: StoreIcon,
    color: "#7c3aed",
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  TELEGRAM: {
    icon: SendIcon,
    color: "#0284c7",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  WHATSAPP: {
    icon: MessageCircleIcon,
    color: "#059669",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  DRAFT_ORDER: {
    icon: ClipboardPenIcon,
    color: "#ea580c",
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
}

/** The fields of a `SalesChannelRow` this console reads. */
export interface ChannelFigures {
  channel: SalesChannel
  total_sales_cents: number
  orders_count: number
  returns_cents: number
  customers_count: number
  previous_total_sales_cents: number | null
}

function emptyRow(channel: SalesChannel): ChannelFigures {
  return {
    channel,
    total_sales_cents: 0,
    orders_count: 0,
    returns_cents: 0,
    customers_count: 0,
    previous_total_sales_cents: null,
  }
}

/**
 * Exactly one row per known channel. The API sends all four, but a channel
 * this console does not know yet is dropped rather than drawn without a
 * colour, and a missing one is zero-filled.
 */
export function normalizeChannelRows(
  rows:
    | ReadonlyArray<
        Omit<ChannelFigures, "channel" | "previous_total_sales_cents"> & {
          channel: string
          previous_total_sales_cents?: number | null
        }
      >
    | null
    | undefined,
): ChannelFigures[] {
  const byChannel = new Map<SalesChannel, ChannelFigures>()
  for (const row of rows ?? []) {
    if (isSalesChannel(row.channel) && !byChannel.has(row.channel)) {
      byChannel.set(row.channel, {
        channel: row.channel,
        total_sales_cents: row.total_sales_cents,
        orders_count: row.orders_count,
        returns_cents: row.returns_cents,
        customers_count: row.customers_count,
        previous_total_sales_cents: row.previous_total_sales_cents ?? null,
      })
    }
  }
  return SALES_CHANNELS.map(
    (channel) => byChannel.get(channel) ?? emptyRow(channel),
  )
}

/** Nothing happened on the channel in the window: no orders, no refunds. */
export function isIdleChannel(row: ChannelFigures): boolean {
  return (
    row.orders_count === 0 &&
    row.total_sales_cents === 0 &&
    row.returns_cents === 0
  )
}

const rank = (channel: SalesChannel) => SALES_CHANNELS.indexOf(channel)

/**
 * Largest sales first, ties in `SALES_CHANNELS` order; channels at zero go
 * last in `SALES_CHANNELS` order, so an empty one never jumps around.
 */
export function orderChannelRows(
  rows: readonly ChannelFigures[],
): ChannelFigures[] {
  const nonZero = rows
    .filter((row) => row.total_sales_cents !== 0)
    .sort(
      (a, b) =>
        b.total_sales_cents - a.total_sales_cents ||
        rank(a.channel) - rank(b.channel),
    )
  const zero = rows
    .filter((row) => row.total_sales_cents === 0)
    .sort((a, b) => rank(a.channel) - rank(b.channel))
  return [...nonZero, ...zero]
}

/**
 * Each channel's slice of the window's sales, as a fraction of the positive
 * total. The server's `share_bps` divides by the net total, so a channel whose
 * refunds outweigh its sales has a negative share and the rest add up to more
 * than 100%; here a negative channel takes no slice and the others are shares
 * of what was actually sold. Same rule as the vendor dashboard.
 */
export function channelShares(
  rows: readonly ChannelFigures[],
): Record<SalesChannel, number> {
  const positive = rows.map((row) => Math.max(0, row.total_sales_cents))
  const total = positive.reduce((sum, value) => sum + value, 0)
  const shares = Object.fromEntries(
    SALES_CHANNELS.map((channel) => [channel, 0]),
  ) as Record<SalesChannel, number>
  rows.forEach((row, i) => {
    shares[row.channel] = total > 0 ? positive[i] / total : 0
  })
  return shares
}

/**
 * A share for display ("86%"), in the console's locale. A real slice under
 * half a percent reads "under 1%" through `below`, never "0%"; a leader that is
 * not the only channel never reads "100%".
 */
export function formatShare(
  fraction: number,
  locale: string,
  below: (share: string) => string,
): string {
  const percent = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value / 100)
  if (!(fraction > 0)) return percent(0)
  let whole = Math.round(fraction * 100)
  if (whole === 0) return below(percent(1))
  if (whole === 100 && fraction < 1) whole = 99
  return percent(whole)
}

/**
 * Change on the previous window of the same length, as a fraction (0.12 is
 * +12%), or null when there is nothing to compare with: no previous figure,
 * or a previous figure at or below zero, where a percentage means nothing.
 */
export function salesChange(row: ChannelFigures): number | null {
  const previous = row.previous_total_sales_cents
  if (previous == null || previous <= 0) return null
  return (row.total_sales_cents - previous) / previous
}

/** A change as a signed percent ("+12%", "−4%", "0%"). */
export function formatChange(change: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(change)
}
