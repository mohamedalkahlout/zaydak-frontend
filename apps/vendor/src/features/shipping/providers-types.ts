/**
 * Shipping mode and carrier accounts.
 *
 * Kept apart from `types.ts` (zones and rates) for the same reason the back-end
 * keeps two modules: what the customer PAYS and who CARRIES the parcel are
 * different questions that happen to share a settings screen.
 */

/**
 * The merchant's explicit choice, not a derived state.
 *
 * `MERCHANT_MANAGED` is a real mode — the shop delivers its own orders — and
 * not "no carrier configured yet". A shop can sit in it with a fully working
 * carrier account on file and stay manual, which is exactly the point.
 */
export type ShippingMode = "MERCHANT_MANAGED" | "SHIPPING_PROVIDER"

export interface ShopShippingSettings {
  /** Whether the shop's own delivery appears at checkout. */
  offers_merchant_delivery: boolean
  /** Whether live carrier prices appear beside it. Independent of the above. */
  offers_carrier_delivery: boolean
  /** Assumed grams for a shippable item with no weight of its own. */
  default_item_weight_grams: number
  mode: ShippingMode
  /**
   * Whether a shipment could actually be booked right now.
   *
   * A shop CAN be in `SHIPPING_PROVIDER` mode with this false — that gap is the
   * thing this screen exists to surface, because nothing else in the product
   * would tell the merchant until an order failed to get a label.
   */
  provider_ready: boolean
  /**
   * Whether this shop has a usable carrier account — enabled AND verified —
   * INDEPENDENT of the mode, where `provider_ready` is not.
   *
   * `provider_ready` is always true for a merchant-managed shop, because such a
   * shop can always fulfil. This is what says whether carrier prices can be
   * quoted at its checkout, which is a separate switch the mode does not
   * govern.
   */
  carrier_available: boolean
  active_provider_slug?: string | null
}

export interface ShopShippingSettingsResponse {
  shopShippingSettings?: {
    success: boolean
    data?: ShopShippingSettings | null
  } | null
}

export interface UpdateShopShippingModeResponse {
  updateShopShippingMode?: {
    success: boolean
    message?: string | null
    data?: ShopShippingSettings | null
  } | null
}

export interface ProviderFieldOption {
  value: string
  label: string
  label_ar: string
}

/** One input the form renders. Comes from the server, never hard-coded here. */
export interface ProviderField {
  key: string
  label: string
  label_ar: string
  type: string
  required: boolean
  /** Rendered as a password input and seeded with the server's mask. */
  secret: boolean
  placeholder?: string | null
  help?: string | null
  help_ar?: string | null
  options?: ProviderFieldOption[] | null
}

export interface ProviderCatalogEntry {
  provider: string
  name: string
  name_ar: string
  description: string
  description_ar: string
  requires_location_mapping: boolean
  supports_sandbox: boolean
  fields: ProviderField[]
}

export interface ProviderCatalogResponse {
  shippingProviderCatalog?: {
    success: boolean
    data?: ProviderCatalogEntry[] | null
  } | null
}

export interface MaskedCredentialField {
  key: string
  /** `••••1234` for a secret, the real value for anything else. */
  masked_value: string
}

export interface ProviderAccount {
  id: string
  provider: string
  is_enabled: boolean
  is_sandbox: boolean
  /** Null means never verified — such an account cannot be enabled. */
  last_verified_at?: string | null
  last_verify_error?: string | null
  masked_credentials: MaskedCredentialField[]
}

export interface ProviderAccountsResponse {
  shippingProviderAccounts?: {
    success: boolean
    data?: ProviderAccount[] | null
  } | null
}

export interface UpsertProviderAccountResponse {
  upsertShippingProviderAccount?: {
    success: boolean
    message?: string | null
    data?: ProviderAccount | null
  } | null
}

export interface VerifyProviderAccountResponse {
  verifyShippingProviderAccount?: {
    success: boolean
    message?: string | null
    data?: { ok: boolean; error?: string | null } | null
  } | null
}

/** Shape shared by the mutations that answer with nothing but an outcome. */
export interface SimpleMutationResult {
  success: boolean
  message?: string | null
}

export interface SetAccountEnabledResponse {
  setShippingProviderAccountEnabled?: SimpleMutationResult | null
}

export interface DeleteAccountResponse {
  deleteShippingProviderAccount?: SimpleMutationResult | null
}

export interface MapLocationResponse {
  mapShippingProviderLocation?: SimpleMutationResult | null
}

export interface UnmapLocationResponse {
  unmapShippingProviderLocation?: SimpleMutationResult | null
}

export interface ProviderLocationMapping {
  id: string
  /** The INTERNAL InventoryLocation id. */
  location_id: string
  location_name?: string | null
  location_city?: string | null
  location_country?: string | null
  /** The carrier's own branch id. Shown because the merchant types it. */
  external_location_id: string
  is_enabled: boolean
}

export interface ProviderLocationsResponse {
  shippingProviderLocations?: {
    success: boolean
    data?: ProviderLocationMapping[] | null
  } | null
}

export interface InventoryLocationLite {
  id: string
  name: string
  city?: string | null
  country?: string | null
  is_active: boolean
  fulfills_online_orders: boolean
}

export interface InventoryLocationsLiteResponse {
  inventoryLocations?: {
    success: boolean
    data?: InventoryLocationLite[] | null
  } | null
}

/**
 * Whether an account is in a state that can actually ship.
 *
 * Enabled alone is not enough — an account is only usable once a live check has
 * passed, and the back-end refuses to enable one that has never verified. This
 * mirrors that rule so the UI cannot promise something the server will refuse.
 */
export function accountIsUsable(account: ProviderAccount): boolean {
  return account.is_enabled && Boolean(account.last_verified_at)
}

/** One carrier the platform can book with, and whether this shop offers it. */
export interface ShopCarrier {
  code: string
  name: string
  /** Absolute https URL from the aggregator. Absent for a carrier it has no image for. */
  logo?: string | null
  enabled: boolean
}

export interface ShopCarriersResponse {
  shopShippingCarriers: {
    success: boolean
    /** True while the shop has stored no choices — every carrier is allowed. */
    using_platform_defaults: boolean
    data?: ShopCarrier[] | null
  }
}

/** One address as the national-address registry formats it. */
export interface ResolvedAddress {
  code: string
  formatted: string
  city: string
  district?: string | null
  street?: string | null
  building_number?: string | null
  postcode?: string | null
  country: string
}

export interface ResolvedAddressResponse {
  lookupNationalAddress: {
    success: boolean
    data?: ResolvedAddress | null
  }
}

export interface EnableCarrierPickupResponse {
  enableCarrierPickup: {
    success: boolean
    /** False when the warehouse was already registered — the action is idempotent. */
    created: boolean
  }
}
