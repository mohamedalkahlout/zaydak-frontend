export type Translatable = Record<string, string> | string

export interface StockRow {
  id: string
  name: Translatable
  slug: string
  sku: string | null
  quantity: number
  units_sold: number
  inventory_cost_cents: number
  revenue_cents: number
  sell_through_bps: number
  days_of_inventory: number | null
  abc_class: string
}

export interface InventorySummary {
  total_products: number
  total_units: number
  inventory_cost_cents: number
  inventory_retail_cents: number
  out_of_stock: number
  low_stock: number
  dead_stock_count: number
  units_sold_window: number
  sell_through_bps: number
}

export interface AbcBreakdown {
  a_count: number
  b_count: number
  c_count: number
  a_revenue_cents: number
  b_revenue_cents: number
  c_revenue_cents: number
}

export interface InventoryAnalytics {
  summary: InventorySummary
  abc: AbcBreakdown
  dead_stock: StockRow[]
  top_movers: StockRow[]
  slow_movers: StockRow[]
  currency: string
}

export interface InventoryAnalyticsResponse {
  inventoryAnalytics: { success: boolean; data: InventoryAnalytics }
}

export interface InventoryAnalyticsInput {
  start: string
  end: string
  lowStockThreshold?: number
  limit?: number
}
