import type { GraphQLResult } from "@/shared/types/api"

export interface Shop {
  id: string
  name: string
  slug: string
  currency?: string | null
  description?: string | null
  logo?: { id: string; original: string; thumbnail: string } | null
  is_active: boolean
  is_approved: boolean
  products_count?: number
  orders_count?: number
  balance?: {
    id: string
    admin_commission_bps: number
    current_balance_cents: number
    total_earnings_cents: number
    withdrawn_amount_cents: number
    is_custom_commission?: boolean
    payment_info?: {
      account?: string | null
      bank?: string | null
      email?: string | null
      name?: string | null
    } | null
  } | null
}

export interface CreateShopResponse {
  createShop: GraphQLResult<Shop>
}

export interface MyShopsResponse {
  myShops: GraphQLResult<Shop[]>
}

/** The two fields the stale-handle redirect needs, and nothing else. */
export interface ShopHandle {
  id: string
  slug: string
}

export interface ResolveShopHandleResponse {
  shop: GraphQLResult<ShopHandle | null>
}
