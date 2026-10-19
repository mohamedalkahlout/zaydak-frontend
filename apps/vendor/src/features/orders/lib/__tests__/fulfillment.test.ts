import { describe, expect, it } from "vitest"
import {
  canFulfill,
  canRefund,
  estimateRefundCents,
  orderRemainingToFulfill,
  remainingToFulfill,
} from "../detail/fulfillment"
import type { Order, OrderProduct, OrderStatus } from "@/features/orders/types"

const line = (over: Partial<OrderProduct> = {}): OrderProduct => ({
  id: "op-1",
  product_id: "p-1",
  name: "Shirt",
  order_quantity: 2,
  unit_price_cents: 5000,
  ...over,
})

const order = (over: Partial<Order> = {}): Order => ({
  id: "ord-1",
  tracking_number: "1001",
  order_status: "order-processing" as OrderStatus,
  payment: { status: "payment-success" },
  pricing: { subtotal_cents: 10000, total_cents: 10000 },
  products: [line()],
  created_at: "2026-07-01T00:00:00.000Z",
  ...over,
})

describe("remainingToFulfill", () => {
  it("treats a line the detail query never gave a fulfilled_quantity as unshipped", () => {
    // `fulfilled_quantity` is optional on the type (the list fragment omits it),
    // so the absent case must read as 0, not NaN.
    expect(remainingToFulfill(line())).toBe(2)
  })

  it("subtracts what already shipped", () => {
    expect(remainingToFulfill(line({ fulfilled_quantity: 1 }))).toBe(1)
  })

  it("never goes negative if the line over-shipped", () => {
    expect(remainingToFulfill(line({ fulfilled_quantity: 5 }))).toBe(0)
  })

  it("sums across lines", () => {
    const o = order({
      products: [line({ fulfilled_quantity: 1 }), line({ id: "op-2", order_quantity: 3 })],
    })
    expect(orderRemainingToFulfill(o)).toBe(4)
  })
})

describe("canFulfill", () => {
  it("offers the action while units remain", () => {
    expect(canFulfill(order())).toBe(true)
  })

  it("hides it once everything shipped", () => {
    expect(canFulfill(order({ products: [line({ fulfilled_quantity: 2 })] }))).toBe(
      false
    )
  })

  it.each(["order-cancelled", "order-refunded", "order-failed"] as OrderStatus[])(
    "refuses to ship a %s order even with unfulfilled lines",
    (status) => {
      // Mirrors the back-end's `not_fulfillable` guard. Keyed on order_status,
      // not fulfillment_status: a partially-shipped order that is then
      // cancelled still has remaining units, and must not offer the button.
      expect(canFulfill(order({ order_status: status }))).toBe(false)
    }
  )
})

describe("canRefund", () => {
  it.each([
    "order-processing",
    "order-at-local-facility",
    "order-out-for-delivery",
    "order-completed",
  ] as OrderStatus[])("allows a refund while %s", (status) => {
    expect(canRefund(order({ order_status: status }))).toBe(true)
  })

  it.each([
    "order-pending",
    "order-cancelled",
    "order-refunded",
    "order-failed",
  ] as OrderStatus[])("blocks a refund when %s", (status) => {
    expect(canRefund(order({ order_status: status }))).toBe(false)
  })
})

describe("estimateRefundCents", () => {
  it("returns the line gross when the order has no discount or tax", () => {
    const o = order()
    expect(estimateRefundCents(o, [{ line: o.products[0]!, quantity: 1 }])).toBe(
      5000
    )
  })

  it("nets out the line's proportional share of the order discount", () => {
    // 100.00 subtotal, 20.00 discount. Refunding one 50.00 unit carries half
    // the discount: 5000 − 1000 = 4000.
    const o = order({
      pricing: { subtotal_cents: 10000, total_cents: 8000, discount_cents: 2000 },
    })
    expect(estimateRefundCents(o, [{ line: o.products[0]!, quantity: 1 }])).toBe(
      4000
    )
  })

  it("adds the line's share of tax on the NET base, not the gross", () => {
    // Subtotal 100.00, discount 20.00 → net base 80.00, tax 8.00 on it.
    // One unit: gross 50.00 − 10.00 discount = 40.00 net, which is half the net
    // base, so it carries half the tax: 4000 + 400 = 4400.
    const o = order({
      pricing: {
        subtotal_cents: 10000,
        total_cents: 8800,
        discount_cents: 2000,
        tax_cents: 800,
      },
    })
    expect(estimateRefundCents(o, [{ line: o.products[0]!, quantity: 1 }])).toBe(
      4400
    )
  })

  it("ignores lines with a zero quantity", () => {
    const o = order()
    expect(estimateRefundCents(o, [{ line: o.products[0]!, quantity: 0 }])).toBe(0)
  })

  it("does not divide by zero on a fully-comped order", () => {
    const o = order({
      products: [line({ unit_price_cents: 0 })],
      pricing: { subtotal_cents: 0, total_cents: 0 },
    })
    expect(estimateRefundCents(o, [{ line: o.products[0]!, quantity: 1 }])).toBe(0)
  })
})
