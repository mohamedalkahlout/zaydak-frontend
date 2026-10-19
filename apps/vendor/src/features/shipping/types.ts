/** Multilang blob the back-end stores for `name`. */
export interface TranslatedText {
  en?: string | null
  ar?: string | null
  [key: string]: string | null | undefined
}

/** `fixed | percentage | free | weight_based` — the API types this as String. */
export type ShippingRateType = "fixed" | "percentage" | "free" | "weight_based"

export const RATE_TYPES: ShippingRateType[] = [
  "fixed",
  "free",
  "percentage",
  "weight_based",
]

export interface ShippingRule {
  id: string
  name: TranslatedText
  type: string
  amount_cents: number
  amount_bps: number
  per_kg_cents: number
  min_order_cents: number
  /** Delivery estimate in days. Null = no promise made; checkout shows nothing. */
  min_delivery_days?: number | null
  max_delivery_days?: number | null
  zone_id?: string | null
  is_global: boolean
  created_at: string
}

export interface ShippingZone {
  id: string
  name: TranslatedText
  /** ISO-3166-1 alpha-2. Empty = catch-all (rest of world). */
  countries: string[]
  /** Optional refine within those countries. Empty matches every state. */
  states: string[]
  /** Stable city codes (e.g. PS-GZA). Empty = every city in listed countries. */
  city_codes: string[]
  /** Tie-break when two zones are equally specific; lower wins. */
  priority: number
  is_global: boolean
  shop_id?: string | null
  rules: ShippingRule[]
}

export interface ShippingZonesResponse {
  shippingZones: { success: boolean; data: ShippingZone[] }
}

export interface ShippingRulesResponse {
  shippingRules: {
    success: boolean
    data: ShippingRule[]
    meta: { page: number; limit: number; total: number; total_pages: number }
  }
}

export type PackageType = "BOX" | "ENVELOPE" | "SOFT_PACKAGE"

export interface ShopPackage {
  id: string
  shop_id: string
  name: string
  package_type: PackageType
  length_mm: number
  width_mm: number
  height_mm: number
  empty_weight_grams: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ShopPackagesResponse {
  shopPackages: {
    success: boolean
    data: ShopPackage[]
  }
}

export interface ShopPackageResponse {
  createShopPackage?: { success: boolean; data?: ShopPackage }
  updateShopPackage?: { success: boolean; data?: ShopPackage }
  setDefaultShopPackage?: { success: boolean; data?: ShopPackage }
  defaultShopPackage?: { success: boolean; data?: ShopPackage }
}
