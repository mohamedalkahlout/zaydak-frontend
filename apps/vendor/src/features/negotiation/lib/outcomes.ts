import type { CsvRow } from "@/shared/lib/csv"
import { centsToMajor } from "@/shared/lib/format"
import type {
  NegotiatedOfferStatus,
  NegotiationOutcome,
  NegotiationChannel,
  NegotiationOutcomesFilter,
  NegotiationSessionStatus,
  NegotiationStrategy,
  NegotiationTrendPoint,
} from "../types"

export const OUTCOMES_PAGE_SIZE = 20

export const SESSION_STATUSES: NegotiationSessionStatus[] = [
  "ACTIVE",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
]

export const CHANNELS: NegotiationChannel[] = ["WEB", "WHATSAPP", "TELEGRAM"]

/** "ALL" is the select's own value for "no filter"; it never reaches the API. */
export type StatusFilter = NegotiationSessionStatus | "ALL"
export type ChannelFilter = NegotiationChannel | "ALL"

/**
 * The filter the query sends, from what the toolbar holds. The window is
 * half-open, matching the back-end: `start` inclusive, `end` exclusive.
 */
export function buildOutcomesFilter(args: {
  start: string
  end: string
  status: StatusFilter
  channel: ChannelFilter
  redeemedOnly: boolean
  /** One product, when the merchant drilled into it from a row. */
  productId?: string | null
}): NegotiationOutcomesFilter {
  return {
    start: args.start,
    end: args.end,
    ...(args.status !== "ALL" ? { status: args.status } : {}),
    ...(args.channel !== "ALL" ? { channel: args.channel } : {}),
    ...(args.redeemedOnly ? { redeemed_only: true } : {}),
    ...(args.productId ? { product_id: args.productId } : {}),
  }
}

/**
 * Badge colour per offer state. Redeemed is the only one that made money, so it
 * is the only green; a lapsed or withdrawn deal reads as muted, not as an error.
 */
export function offerStatusClassName(
  status: NegotiatedOfferStatus | null,
): string {
  switch (status) {
    case "USED":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    case "PENDING":
    case "CLAIMED":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

/** Rows the CSV export reads at most — fifty pages of the API's hundred. */
export const OUTCOMES_EXPORT_LIMIT = 5000

/** Cents as a plain amount for a spreadsheet: "85.00", or empty for none. */
const amount = (cents: number | null | undefined): string =>
  cents == null ? "" : centsToMajor(cents).toFixed(2)

/**
 * The outcomes as spreadsheet rows, one per session — the table's columns,
 * money as plain amounts in the row's currency so a sum in the spreadsheet
 * works, and the deal whose order unwound marked rather than dropped.
 */
export function outcomesCsvRows(rows: NegotiationOutcome[]): CsvRow[] {
  return rows.map((row) => ({
    date: row.created_at,
    product: row.product_title,
    variation: row.variation_title ?? "",
    customer: row.customer_label ?? "",
    guest: row.is_guest ? "yes" : "no",
    channel: row.channel,
    rounds: row.rounds,
    session_status: row.session_status,
    list_price: amount(row.list_price_cents),
    last_offer: amount(row.last_offer_cents),
    final_price: amount(row.final_price_cents),
    quantity: row.quantity ?? "",
    offer_status: row.offer_status ?? "",
    order_unwound: row.order_unwound ? "yes" : "no",
    discount_from_list: amount(row.discount_cents),
    margin_over_cost: amount(row.margin_cents),
    currency: row.currency,
    order_id: row.order_id ?? "",
  }))
}

// ─── Rollups ────────────────────────────────────────────────────────────────

/** Firmest first — the order the back-end returns them in. */
export const STRATEGIES: NegotiationStrategy[] = [
  "conservative",
  "balanced",
  "aggressive",
]

/** Products the breakdown lists; the API counts the rest in `products_total`. */
export const ROLLUP_PRODUCT_LIMIT = 10

/**
 * Basis points as a percentage a merchant reads ("13.3%"), or "—" when the
 * rate has no base — never "0%", which would claim a measured nothing.
 */
export function formatRate(
  bps: number | null | undefined,
  locale?: string,
): string {
  if (bps == null) return "—"
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(bps / 10000)
}

/** Mean rounds to close, to one decimal, or "—" when no deal closed. */
export function formatRounds(
  rounds: number | null | undefined,
  locale?: string,
): string {
  if (rounds == null) return "—"
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    rounds,
  )
}

/** One trend bucket, flattened for the chart. */
export interface NegotiationTrendChartPoint {
  date: string
  sessions: number
  accepted: number
  redeemed: number
  revenue_cents: number
  discount_cents: number
}

export function trendChartPoints(
  trend: NegotiationTrendPoint[],
): NegotiationTrendChartPoint[] {
  return trend.map(({ date, figures }) => ({
    date,
    sessions: figures.sessions,
    accepted: figures.accepted,
    redeemed: figures.redeemed,
    revenue_cents: figures.revenue_cents,
    discount_cents: figures.discount_cents,
  }))
}

/** Whether any bucket had a negotiation — a row of zero bars says nothing. */
export function trendHasData(points: NegotiationTrendChartPoint[]): boolean {
  return points.some((p) => p.sessions > 0)
}
