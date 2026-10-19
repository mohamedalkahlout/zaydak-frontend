export type AttributionChannel =
  | "DIRECT"
  | "ORGANIC_SEARCH"
  | "PAID_SEARCH"
  | "SOCIAL"
  | "PAID_SOCIAL"
  | "EMAIL"
  | "REFERRAL"
  | "AFFILIATE"
  | "OTHER"

export type AttributionModel =
  | "LAST_TOUCH"
  | "FIRST_TOUCH"
  | "LINEAR"
  | "POSITION_BASED"
  | "TIME_DECAY"

export type AttributionDimension = "SOURCE" | "MEDIUM" | "CAMPAIGN" | "CHANNEL"

export interface AttributionRow {
  key: string
  channel: AttributionChannel | null
  revenue_cents: number
  orders: number
  units: number
  aov_cents: number
  new_customers: number
  returning_customers: number
  conversion_rate_bps: number | null
  cac_cents: number | null
  roas_bps: number | null
}

export interface AttributionReport {
  rows: AttributionRow[]
  totals: AttributionRow
  group_by: AttributionDimension
  model: AttributionModel
  currency: string
}

export interface AttributionReportResponse {
  attributionReport: { success: boolean; data: AttributionReport }
}

export interface AttributionReportInput {
  start: string
  end: string
  groupBy?: AttributionDimension
  model?: AttributionModel
}

export type AdSpendSourceKind = "MANUAL" | "CONNECTOR"

export interface AdSpend {
  id: string
  channel: AttributionChannel
  source: string
  campaign: string | null
  date: string
  spend_cents: number
  currency: string
  exchange_rate_bps: number
  normalized_spend_cents: number
  impressions: number | null
  clicks: number | null
  source_kind: AdSpendSourceKind
  created_at: string
}

export interface AdSpendsResponse {
  adSpends: { success: boolean; data: AdSpend[] }
}

export interface CreateAdSpendResponse {
  createAdSpend: { success: boolean; data: AdSpend }
}

export interface UpdateAdSpendResponse {
  updateAdSpend: { success: boolean; data: AdSpend }
}

export interface AdSpendInput {
  channel: AttributionChannel
  source: string
  campaign?: string
  date: string
  spend_cents: number
  currency?: string
  exchange_rate_bps?: number
  impressions?: number
  clicks?: number
}
