export interface CustomerSummary {
  total_customers: number
  one_time_customers: number
  repeat_customers: number
  repeat_rate_bps: number
  total_orders: number
  total_revenue_cents: number
  avg_ltv_cents: number
  avg_orders_per_customer_x100: number
  new_customers: number
  returning_customers: number
  active_customers: number
  window_revenue_cents: number
  window_orders: number
}

export interface CohortRow {
  cohort: string
  size: number
  retention_bps: number[]
}

export interface TopCustomer {
  id: string
  name: string | null
  email: string | null
  orders_count: number
  total_spent_cents: number
}

export interface CustomerAnalytics {
  summary: CustomerSummary
  cohorts: CohortRow[]
  top_customers: TopCustomer[]
  currency: string
  timezone: string
}

export interface CustomerAnalyticsResponse {
  customerAnalytics: { success: boolean; data: CustomerAnalytics }
}

export interface CustomerAnalyticsInput {
  start: string
  end: string
  cohortMonths?: number
  topLimit?: number
}
