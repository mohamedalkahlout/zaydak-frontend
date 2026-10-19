import { describe, expect, it } from "vitest"
import {
  canCancel,
  canRefreshTracking,
  totalWeightGrams,
  type Shipment,
} from "../types"

/**
 * The client-side rules that mirror server refusals.
 *
 * Each exists so the UI does not offer an action the save is going to reject —
 * a control that fails on click tells the merchant they did something wrong
 * when the product knew all along it was unavailable.
 */

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: "shp-1",
  order_id: "ord-1",
  status: "pending",
  created_at: "2026-08-22T10:00:00Z",
  ...over,
})

describe("canCancel", () => {
  it("allows cancelling a shipment still in flight", () => {
    expect(canCancel(shipment({ status: "shipped" }))).toBe(true)
  })

  // Cancelling would not recall the parcel; a return is a different operation
  // with different money attached.
  it("refuses a delivered shipment", () => {
    expect(canCancel(shipment({ status: "delivered" }))).toBe(false)
  })

  it("refuses one already cancelled", () => {
    expect(canCancel(shipment({ status: "cancelled" }))).toBe(false)
  })
})

describe("canRefreshTracking", () => {
  it("allows it for a carrier booking", () => {
    expect(canRefreshTracking(shipment({ provider_slug: "oto" }))).toBe(true)
  })

  // There is no carrier to ask, and the server refuses rather than overwriting
  // the merchant's own history with an empty snapshot.
  it("refuses merchant-managed delivery", () => {
    expect(canRefreshTracking(shipment({ provider_slug: "manual" }))).toBe(false)
  })

  it("refuses a legacy row with no provider recorded", () => {
    expect(canRefreshTracking(shipment())).toBe(false)
  })
})

describe("totalWeightGrams", () => {
  it("sums the boxes that were weighed", () => {
    const s = shipment({
      packages: [
        { id: "a", weight_grams: 900 },
        { id: "b", weight_grams: 1100 },
      ],
    })
    expect(totalWeightGrams(s)).toBe(2000)
  })

  // An unweighed box is not a zero-weight box. Counting it as 0 would report a
  // total that looks precise and is short.
  it("ignores boxes with no weight rather than counting them as zero", () => {
    const s = shipment({
      packages: [
        { id: "a", weight_grams: 900 },
        { id: "b", weight_grams: null },
      ],
    })
    expect(totalWeightGrams(s)).toBe(900)
  })

  it("returns null when nothing was weighed at all", () => {
    expect(totalWeightGrams(shipment({ packages: [{ id: "a" }] }))).toBeNull()
  })

  it("returns null when the shipment has no packages", () => {
    expect(totalWeightGrams(shipment())).toBeNull()
  })

  // Zero is a real weight somebody entered, distinct from "not weighed".
  it("treats an explicit zero as a weighed box", () => {
    const s = shipment({ packages: [{ id: "a", weight_grams: 0 }] })
    expect(totalWeightGrams(s)).toBe(0)
  })
})
