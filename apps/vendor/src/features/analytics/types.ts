// Hand-written response types mirroring the back-end analytics schema. The
// codegen client preset still validates the operations in `api/queries.ts`
// against the SDL; these typed shapes are what the components consume.

import type { CustomerAnalytics } from "@/features/customer-analytics/types"
import type { AttributionReport } from "@/features/attribution/types"
import type { SalesChannel } from "@/shared/lib/sales-channels"

export interface SalesBreakdown {
  gross_sales_cents: number
  discounts_cents: number
  returns_cents: number
  net_sales_cents: number
  shipping_cents: number
  taxes_cents: number
  total_sales_cents: number
  orders_count: number
  // Leaf orders placed in the window that are fully fulfilled (any status).
  fulfilled_orders_count: number
  // Restocking fees retained on returns received in the window. Informational:
  // returns_cents is already net of these fees.
  return_fees_cents: number
  average_order_value_cents: number
  returning_customer_rate_bps: number
  // Profit (Phase 1) — gross_profit = net_sales − cogs; net_profit = gross_profit − fees.
  cogs_cents: number
  fees_cents: number
  gross_profit_cents: number
  net_profit_cents: number
  margin_bps: number
  units_missing_cost: number
  cost_coverage_bps: number
  is_estimated: boolean
}

export interface SalesTimePoint {
  date: string
  total_sales_cents: number
  orders_count: number
}

export interface SalesReport {
  start: string
  end: string
  granularity: string
  currency: string
  timezone: string
  current: SalesBreakdown
  previous: SalesBreakdown | null
  series: SalesTimePoint[]
  previous_series: SalesTimePoint[] | null
}

export interface SalesReportInput {
  start: string
  end: string
  compare?: boolean
  /** Omitted, the API picks day (up to ~92 days) or month; week is asked for. */
  granularity?: "day" | "week" | "month"
}

export interface SalesReportResponse {
  salesReport: { success: boolean; data: SalesReport }
}

/**
 * One channel's slice of `salesByChannel`. Money is integer cents; the four
 * rows add up to `salesReport.current` for the same window (sales, orders,
 * returns). `share_bps` is the server's net share and can be negative when a
 * channel's refunds outweigh its sales — the section draws its own clamped
 * split (`lib/channel-mix.ts`) instead. `previous_*` is null when the report
 * was asked for no comparison. `connected` is whether the chat channel is
 * live now (always true for the online store and manual orders).
 */
export interface SalesChannelRow {
  channel: SalesChannel
  orders_count: number
  total_sales_cents: number
  returns_cents: number
  average_order_value_cents: number
  customers_count: number
  share_bps: number
  previous_total_sales_cents: number | null
  previous_orders_count: number | null
  connected: boolean
  series: SalesTimePoint[]
}

export interface SalesByChannelReport {
  start: string
  end: string
  granularity: string
  currency: string
  timezone: string
  total_sales_cents: number
  orders_count: number
  rows: SalesChannelRow[]
}

export interface SalesByChannelInput {
  start: string
  end: string
  compare?: boolean
}

export interface SalesByChannelResponse {
  salesByChannel: { success: boolean; data: SalesByChannelReport }
}

/**
 * Combined range-dependent query — salesReport + topProducts (+ sell-through,
 * customer analytics, and channel attribution, all resolved server-side in the
 * same round trip).
 */
export interface AnalyticsOverviewResponse {
  salesReport: { success: boolean; data: SalesReport }
  topProducts: { success: boolean; data: TopProduct[] }
  sellThroughProducts: { success: boolean; data: SellThroughProduct[] }
  customerAnalytics: { success: boolean; data: CustomerAnalytics }
  attributionReport: { success: boolean; data: AttributionReport }
}

export interface SellThroughProduct {
  id: string
  name: Translatable
  slug: string
  sold_units: number
  on_hand: number
  sell_through_bps: number
}

/** Combined range-independent query (ordersByStatus + lowStock + categorySales). */
export interface AnalyticsSecondaryResponse {
  ordersByStatus: { success: boolean; data: OrdersByStatusData }
  lowStockProducts: { success: boolean; data: LowStockProduct[] }
  categorySales: { success: boolean; data: CategorySale[] }
}

export interface AnalyticsSummary {
  /** Integer cents — format with formatMoneyCents. */
  total_revenue_cents: number
  /** Integer cents — format with formatMoneyCents. */
  todays_revenue_cents: number
  total_refunds: number
  total_orders: number
  total_shops: number
  new_customers: number
  total_vendors: number | null
}

export interface AnalyticsSummaryResponse {
  analytics: { success: boolean; data: AnalyticsSummary }
}

export interface OrdersByStatusData {
  pending: number
  processing: number
  completed: number
  cancelled: number
  refunded: number
  failed: number
  at_local_facility: number
  out_for_delivery: number
}

export interface OrdersByStatusResponse {
  ordersByStatus: { success: boolean; data: OrdersByStatusData }
}

type Translatable = Record<string, string> | string

export interface TopProduct {
  id: string
  name: Translatable
  slug: string
  image?: unknown
  orders_count: number
  /** Integer cents — format with formatMoneyCents. */
  total_sales_cents: number
}

export interface TopProductsResponse {
  topProducts: { success: boolean; data: TopProduct[] }
}

export interface LowStockProduct {
  id: string
  name: Translatable
  slug: string
  quantity: number
  shop_id?: string | null
}

export interface LowStockProductsResponse {
  lowStockProducts: { success: boolean; data: LowStockProduct[] }
}

export interface CategorySale {
  category_id: string
  name: Translatable
  slug: string
  product_count: number
  total_quantity_sold: number
}

export interface CategorySalesResponse {
  categorySales: { success: boolean; data: CategorySale[] }
}
