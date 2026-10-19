import type { GraphQLResult, PaginationMeta } from "@/shared/types/api"

export type AbandonedCartReminderStatus =
  | "READY"
  | "SENT"
  | "RETURNED"
  | "FAILED"
  | "COMPLETED"
export type AbandonedCartChannel = "EMAIL" | "SMS" | "WHATSAPP"
export type AbandonedCartSortField =
  | "LAST_ACTIVITY"
  | "ITEM_COUNT"
  | "TOTAL"
  | "CREATED_AT"
export type AbandonedCartSortDir = "ASC" | "DESC"
export type AbandonedCartsView = "customer" | "product"

export interface AbandonedCartCustomer {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
}

export interface AbandonedCartLine {
  id: string
  product_id: string
  variation_option_id?: string | null
  name: string
  slug?: string | null
  image?: { original?: string; thumbnail?: string } | null
  quantity: number
  unit_price_cents?: number | null
  total_cents?: number | null
}

export interface AbandonedCartChannels {
  email: boolean
  sms: boolean
  whatsapp: boolean
}

export interface AbandonedCartReminderChannels {
  sent?: AbandonedCartChannel[]
  failed?: AbandonedCartChannel[]
}

export interface AbandonedCart {
  id: string
  status: string
  reminder_status: AbandonedCartReminderStatus
  hidden: boolean
  customer?: AbandonedCartCustomer | null
  items: AbandonedCartLine[]
  item_count: number
  total_cents?: number | null
  currency: string
  channels: AbandonedCartChannels
  created_at: string
  last_activity_at?: string | null
  abandoned_at?: string | null
  last_reminder_at?: string | null
  last_reminder_failed_at?: string | null
  last_reminder_channels?: AbandonedCartReminderChannels | null
  marketing_hidden_at?: string | null
  marketing_draft_order_id?: string | null
  /**
   * First open of the reminder's signed cart link after the latest send — a
   * click reported by the storefront, not an email-open pixel.
   */
  reminder_link_opened_at?: string | null
}

export interface AbandonedCartProductRow {
  product_id: string
  name: string
  slug?: string | null
  image?: { original?: string; thumbnail?: string } | null
  cart_count: number
  lost_revenue_cents?: number | null
  currency: string
  last_left_at?: string | null
}

export interface AbandonedCartStatusCount {
  status: AbandonedCartReminderStatus
  count: number
}

export interface AbandonedCartsSummary {
  total_abandoned: number
  recovered: number
  recovery_rate: number
  average_cart_cents: number
  currency: string
}

export type AbandonedCartOpKind =
  | "SEND"
  | "HIDE"
  | "UNHIDE"
  | "BULK_HIDE"
  | "BULK_UNHIDE"

/** One send / hide / unhide row from the shop's abandoned-cart activity log. */
export interface AbandonedCartOp {
  id: string
  op: AbandonedCartOpKind
  cart_id?: string | null
  cart_ids?: string[] | null
  actor_name?: string | null
  actor_email?: string | null
  channels?: AbandonedCartChannel[] | null
  failed_channels?: AbandonedCartChannel[] | null
  coupon_code?: string | null
  created_at: string
}

export interface AbandonedCartsResponse {
  abandonedCarts: GraphQLResult<AbandonedCart[]> & { meta: PaginationMeta }
}

export interface AbandonedCartsByProductResponse {
  abandonedCartsByProduct: GraphQLResult<AbandonedCartProductRow[]> & {
    meta: PaginationMeta
  }
}

export interface AbandonedCartsSummaryResponse {
  abandonedCartsSummary: GraphQLResult<AbandonedCartsSummary>
}

/**
 * One count per status for the list's filter with the status left out — what
 * the list would show if that status were picked.
 */
export interface AbandonedCartStatusCountsResponse {
  abandonedCartStatusCounts: {
    success: boolean
    data: AbandonedCartStatusCount[]
  }
}

/**
 * The ids the list's filter matches, in the list's order, cut to the first
 * `SELECT_ALL_LIMIT`. `total` above `data.length` means it was cut.
 */
export interface AbandonedCartIdsResponse {
  abandonedCartIds: { success: boolean; data: string[]; total: number }
}

export interface AbandonedCartOpsResponse {
  abandonedCartOps: GraphQLResult<AbandonedCartOp[]> & { meta: PaginationMeta }
}

export interface AbandonedCheckoutSettingResponse {
  setting: GraphQLResult<{ key: string; value?: unknown } | null>
}

export interface SendAbandonedCartReminderResponse {
  sendAbandonedCartReminder: GraphQLResult<{
    cart_id: string
    sent_channels: AbandonedCartChannel[]
    failed_channels: AbandonedCartChannel[]
    coupon_code?: string | null
    preview_body?: string | null
  }>
}

export interface HideAbandonedCartsResponse {
  hideAbandonedCarts: { success: boolean; updated: number }
}
