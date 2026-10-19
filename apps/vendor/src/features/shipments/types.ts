/** One physical box inside a shipment. */
export interface ShipmentPackage {
  id: string
  weight_grams?: number | null
  length_mm?: number | null
  width_mm?: number | null
  height_mm?: number | null
  tracking_number?: string | null
  label_url?: string | null
}

/**
 * One entry in a shipment's history.
 *
 * `source` separates a carrier's own update from a merchant typing one in.
 * Without it the two are indistinguishable after the fact — which is exactly
 * the question asked when they disagree.
 */
export interface ShipmentTrackingEvent {
  id: string
  status: string
  description?: string | null
  occurred_at: string
  /** provider | manual | system */
  source: string
}

export interface Shipment {
  id: string
  order_id: string
  fulfillment_id?: string | null
  status: string
  /**
   * Registry slug of whatever executed this shipment. `manual` means the
   * merchant delivers it themselves — it can never come from a failed carrier
   * call, because that path throws. Null on rows predating providers.
   */
  provider_slug?: string | null
  delivery_company?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  label_url?: string | null
  external_shipment_id?: string | null
  estimated_delivery?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
  /**
   * What the carrier billed, minor units. Shop staff only — absent entirely for
   * the customer. Null means **not known yet**, which is not the same as free.
   */
  actual_cost_cents?: number | null
  /** provider | manual */
  cost_source?: string | null
  notes?: string | null
  created_at: string
  packages?: ShipmentPackage[] | null
  tracking_events?: ShipmentTrackingEvent[] | null
}

export interface OrderShipmentsResponse {
  shipments?: { success: boolean; data?: Shipment[] | null } | null
}

export interface OrderShippingEconomics {
  order_id: string
  /** Net of anything refunded. What the shop actually kept. */
  customer_charge_cents: number
  /** Summed across the order's shipments. Null when no cost is known. */
  actual_cost_cents?: number | null
  merchant_subsidy_cents?: number | null
  merchant_margin_cents?: number | null
  /**
   * Whether every shipment has a known cost.
   *
   * Not decoration: an order with two shipments where one has no invoice yet
   * produces a subsidy that is too small and looks entirely reasonable.
   */
  is_complete: boolean
}

export interface OrderShippingEconomicsResponse {
  orderShippingEconomics?: {
    success: boolean
    data?: OrderShippingEconomics | null
  } | null
}

export interface ShipmentMutationResponse {
  success: boolean
  message?: string | null
  data?: Shipment | null
}

/** The shipment lifecycle, in the order it actually progresses. */
export const SHIPMENT_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

/**
 * Whether this shipment can still be cancelled.
 *
 * Mirrors the server: a delivered parcel is not recalled by cancelling the
 * record, and an already-cancelled one is a no-op. Showing the action anyway
 * would offer something the save is going to refuse.
 */
export function canCancel(shipment: Shipment): boolean {
  return shipment.status !== "delivered" && shipment.status !== "cancelled"
}

/**
 * Whether refreshing tracking can do anything.
 *
 * Merchant-managed shipments have no carrier to ask, and the server refuses
 * rather than overwriting the merchant's own history with an empty snapshot.
 */
export function canRefreshTracking(shipment: Shipment): boolean {
  return Boolean(shipment.provider_slug) && shipment.provider_slug !== "manual"
}

/** Total weight the merchant recorded across a shipment's boxes, in grams. */
export function totalWeightGrams(shipment: Shipment): number | null {
  const boxes = shipment.packages ?? []
  const known = boxes.filter((b) => typeof b.weight_grams === "number")
  if (known.length === 0) return null
  return known.reduce((sum, b) => sum + (b.weight_grams ?? 0), 0)
}
