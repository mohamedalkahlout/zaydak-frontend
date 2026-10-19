import type { GraphQLResult } from "@/shared/types/api"

/**
 * A pending "Notify when back in stock" subscriber. One row per
 * (target, email). `variation_option_id` is null for SIMPLE-product
 * subscribers (whole listing) and set to the specific variant id for
 * VARIABLE products where the customer picked a SKU.
 */
export interface StockNotification {
  id: string
  email: string
  product_id: string
  variation_option_id?: string | null
  customer_id?: string | null
  created_at: string
}

export interface PendingStockNotificationsResponse {
  pendingStockNotifications: GraphQLResult<StockNotification[]>
}
