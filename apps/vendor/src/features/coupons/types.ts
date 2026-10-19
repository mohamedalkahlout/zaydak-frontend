import type { GraphQLResult, PaginationMeta, TranslatedText } from "@/shared/types/api"

export type CouponType =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping"

export type CouponValueType = "fixed" | "percentage"

// The server emits GraphQL enums in their UPPERCASE wire form (e.g.
// "AMOUNT_OFF_PRODUCTS", "PERCENTAGE", "AUTOMATIC"). The lowercase
// literals in `CouponType` / `CouponValueType` above are the *domain*
// form used by our Zod schemas and form state — helpers like
// `normalizeCouponType` bridge the two. Fields below that carry an
// enum accept either casing so call sites can compare against the form
// literal if they haven't normalized yet.
export type CouponClass = "PRODUCT" | "ORDER" | "SHIPPING"

export interface CouponProductRef {
  id: string
  name: string | TranslatedText | null
  slug: string
  image?: { original?: string; thumbnail?: string } | null
}

export interface CouponCustomerRef {
  id: string
  name?: string | null
  email?: string | null
}

export interface CouponSegmentRef {
  id: string
  name: string
}

export interface Coupon {
  id: string
  code: string
  description?: string | null
  type: CouponType | Uppercase<CouponType>
  value_type?: CouponValueType | Uppercase<CouponValueType> | null
  /** Fixed-discount amount (used when `value_type === 'fixed'`). */
  amount_cents: number
  /** Basis points for percentage discounts (1500 = 15.00%), 1-10000. */
  percent_bps?: number | null
  minimum_cart_amount_cents?: number | null
  minimum_quantity?: number | null
  max_discount_cents?: number | null
  buy_quantity?: number | null
  get_quantity?: number | null
  get_discount_type?: "PERCENT" | "AMOUNT" | "FREE" | null
  get_discount_percent_bps?: number | null
  get_discount_amount_cents?: number | null
  active_from: string
  expire_at?: string | null
  max_uses?: number | null
  max_uses_per_user?: number | null
  max_uses_per_order?: number | null
  method?: "code" | "automatic" | "CODE" | "AUTOMATIC" | null
  eligibility?:
    | "all_customers"
    | "specific_customers"
    | "segment"
    | "ALL_CUSTOMERS"
    | "SPECIFIC_CUSTOMERS"
    | "SEGMENT"
    | null
  customer_ids?: string[] | null
  segment_ids?: string[] | null
  collection_ids?: string[] | null
  product_ids?: string[] | null
  /** BOGO separate-pool scope (backend falls back to `product_ids`/`collection_ids` when empty). */
  buy_product_ids?: string[] | null
  buy_collection_ids?: string[] | null
  get_product_ids?: string[] | null
  get_collection_ids?: string[] | null
  countries?: string[] | null
  exclude_shipping_rates_over_cents?: number | null
  is_exclusive?: boolean | null
  combinations?: {
    allow_product: boolean
    allow_order: boolean
    allow_shipping: boolean
  } | null
  /** Higher first for `applyAutomatic` ordering. */
  priority?: number | null
  currency?: string | null
  /** Derived bucket used for stacking rules. */
  class?: CouponClass | null
  target?: string | null
  language?: string | null
  timezone?: string | null
  /** Count of successful redemptions (from `CouponUsage` ledger). */
  times_used?: number | null
  /** Active window only (now between active_from and expire_at). */
  is_valid: boolean
  /** Eligibility + per-user cap + global cap for the current user. Null for guests. */
  is_valid_for_me?: boolean | null
  image?: { original?: string; thumbnail?: string } | null
  created_at: string
  updated_at: string
  // Populated only by `coupon(id)` — list queries return [].
  products?: CouponProductRef[]
  customers?: CouponCustomerRef[]
  segments?: CouponSegmentRef[]
}

export interface CouponsResponse {
  coupons: GraphQLResult<Coupon[]> & { meta?: PaginationMeta }
}

// ── Coupon analytics & verify ─────────────────────────

export interface CouponPerformance {
  coupon_id: string
  times_used: number
  total_discount_given_cents: number
  total_revenue_attributed_cents: number
  avg_order_value_cents: number
  first_used_at?: string | null
  last_used_at?: string | null
}

export interface CouponPerformanceResponse {
  couponPerformance: GraphQLResult<CouponPerformance>
}

export interface CouponDiscountPreview {
  total_cents: number
  product_cents: number
  order_cents: number
  shipping_cents: number
  cart_hash?: string | null
}

export type VerifyCouponReasonCode =
  | "not_yet_active"
  | "expired"
  | "requires_login"
  | "not_eligible"
  | "segment_missing"
  | "global_limit"
  | "user_limit"
  | "no_match"
  | "minimum_cart_not_met"
  | "minimum_quantity_not_met"
  | "discount_zero"
  | "bogo_not_met"
  | "country_not_allowed"
  | "shipping_rate_over_cap"
  | "conflict"
  | "not_found"

export type CouponConflictReason =
  | "exclusive_candidate"
  | "exclusive_applied"
  | "class_incompatible"
  | "class_incompatible_reverse"
  | "legacy_general"
  | "legacy_overlap"

export interface CouponConflictRef {
  coupon_id?: string | null
  code: string
  class: CouponClass
  reason: CouponConflictReason | string
  message: string
}

export interface VerifyCouponResponseData {
  is_valid: boolean
  message: string
  reason_code?: VerifyCouponReasonCode | string | null
  coupon?: Coupon | null
  discount_preview?: CouponDiscountPreview | null
  conflicts_with?: CouponConflictRef[] | null
}

export interface VerifyCouponResponse {
  verifyCoupon: VerifyCouponResponseData
}
