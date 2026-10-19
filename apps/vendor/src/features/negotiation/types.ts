// Hand-written result types for `negotiationOutcomes` (vendor convention: the
// document in `api-outcomes.ts` uses `gql` from @apollo/client, not the codegen
// tag). Field names mirror `NegotiationOutcomeEntry` / `NegotiationOutcomesSummary`
// in back-end/src/negotiation/types/negotiation.types.ts.

export type NegotiationChannel = "WEB" | "WHATSAPP" | "TELEGRAM"

export type NegotiationSessionStatus =
  | "ACTIVE"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"

export type NegotiatedOfferStatus =
  | "PENDING"
  | "CLAIMED"
  | "USED"
  | "EXPIRED"
  | "CANCELLED"

export interface NegotiationOutcome {
  session_id: string
  created_at: string
  product_id: string
  variation_option_id: string | null
  product_title: string
  variation_title: string | null
  channel: NegotiationChannel
  session_status: NegotiationSessionStatus
  rounds: number
  max_rounds: number
  /** Already masked by the back-end. Never a raw guest key or phone number. */
  customer_label: string | null
  is_guest: boolean
  list_price_cents: number
  /** The last price the engine offered, deal or not. */
  last_offer_cents: number | null
  /** The agreed unit price; null when no deal was struck. */
  final_price_cents: number | null
  quantity: number | null
  offer_status: NegotiatedOfferStatus | null
  offer_expires_at: string | null
  redeemed_at: string | null
  order_id: string | null
  /**
   * The order this deal was spent on has since been cancelled, failed or
   * refunded: the offer still reads USED, and its discount and margin never
   * landed. The summary already leaves it out.
   */
  order_unwound: boolean
  /** Money off list: (list − final) × quantity. */
  discount_cents: number | null
  /**
   * Margin over cost, after the payment fee: (final − cost) × quantity − the
   * deal's processing fee. Null without a cost.
   */
  margin_cents: number | null
  currency: string
}

export interface NegotiationOutcomesSummary {
  sessions: number
  accepted: number
  redeemed: number
  acceptance_bps: number
  conversion_bps: number
  revenue_cents: number
  discount_cents: number
  margin_cents: number | null
  redeemed_without_cost: number
  currency: string
}

export interface NegotiationOutcomesMeta {
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface NegotiationOutcomesFilter {
  start?: string
  end?: string
  status?: NegotiationSessionStatus
  channel?: NegotiationChannel
  product_id?: string
  redeemed_only?: boolean
}

export interface NegotiationOutcomesResponse {
  negotiationOutcomes: {
    success: boolean
    data: NegotiationOutcome[]
    meta: NegotiationOutcomesMeta
    summary: NegotiationOutcomesSummary
  }
}

export interface NegotiationOutcomesVariables {
  filter?: NegotiationOutcomesFilter
  page?: number
  limit?: number
}

// ─── Rollups (`negotiationOutcomeRollups`) ──────────────────────────────────
// Mirrors `NegotiationOutcomeFigures` and its parents in
// back-end/src/negotiation/types/negotiation.types.ts.

export type NegotiationStrategy = "conservative" | "balanced" | "aggressive"

/** One group's figures: the total, a product, a strategy or a trend bucket. */
export interface NegotiationOutcomeFigures {
  sessions: number
  accepted: number
  redeemed: number
  acceptance_bps: number
  conversion_bps: number
  revenue_cents: number
  discount_cents: number
  /** Discount ÷ list value over redeemed deals. Null when nothing was redeemed. */
  avg_discount_bps: number | null
  margin_cents: number | null
  /** Margin ÷ selling price over redeemed deals with a cost. May be negative. */
  margin_bps: number | null
  redeemed_without_cost: number
  /** Deals that closed at the session's floor. The floor itself never arrives. */
  floor_reached: number
  floor_reached_bps: number | null
  avg_rounds_to_close: number | null
}

export interface NegotiationProductRollup {
  product_id: string
  product_title: string
  figures: NegotiationOutcomeFigures
}

export interface NegotiationStrategyRollup {
  strategy: NegotiationStrategy
  figures: NegotiationOutcomeFigures
}

export interface NegotiationTrendPoint {
  /** A shop-local day (`YYYY-MM-DD`) or month (`YYYY-MM`). */
  date: string
  figures: NegotiationOutcomeFigures
}

export interface NegotiationOutcomeRollups {
  /** `day`, `week` (keyed by its Monday) or `month`. */
  granularity: string
  timezone: string
  currency: string
  products_total: number
  total: NegotiationOutcomeFigures
  products: NegotiationProductRollup[]
  strategies: NegotiationStrategyRollup[]
  trend: NegotiationTrendPoint[]
}

export interface NegotiationOutcomeRollupsResponse {
  negotiationOutcomeRollups: {
    success: boolean
    data: NegotiationOutcomeRollups
  }
}

export interface NegotiationOutcomeRollupsVariables {
  filter?: NegotiationOutcomesFilter
  granularity?: "day" | "week" | "month"
  product_limit?: number
}
