import type { GraphQLResult, PaginationMeta } from "@/shared/types/api"

/**
 * As the API *reads* it back — lowercase. Note the asymmetry with the input
 * enum below; see `lib/status.ts`.
 */
export type ReturnStatus =
  | "requested"
  | "approved"
  | "in_transit"
  | "received"
  | "closed"
  | "rejected"

/** As the API *accepts* it — the GraphQL `ReturnStatus` enum, uppercase. */
export type ReturnStatusInput =
  | "REQUESTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "CLOSED"
  | "REJECTED"

export interface ReturnLineItem {
  id: string
  order_product_id: string
  quantity: number
  reason?: string | null
  restock: boolean
}

export interface ReturnEntry {
  id: string
  order_id: string
  customer_id: string
  shop_id?: string | null
  status: ReturnStatus
  reason?: string | null
  note?: string | null
  /** Withheld from the refund. Set when the goods are marked received. */
  restocking_fee_cents: number
  /** The refund the back-end issued on `received`. */
  refund_id?: string | null
  line_items: ReturnLineItem[]
  requested_at: string
  received_at?: string | null
  closed_at?: string | null
  created_at: string
}

export interface ReturnsResponse {
  returns: GraphQLResult<ReturnEntry[]> & { meta?: PaginationMeta }
}

export interface UpdateReturnStatusResponse {
  updateReturnStatus: GraphQLResult<ReturnEntry>
}
