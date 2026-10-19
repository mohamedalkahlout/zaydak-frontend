import { describe, expect, it } from "vitest"

import {
  isPurchasable,
  maxOrderableQuantity,
  priceDisplay,
  stockState,
} from "../product"

const simple = {
  product_type: "SIMPLE",
  price_cents: 2000,
  selling_price_cents: 2000,
  compare_at_price_cents: null,
  min_price_cents: null,
  max_price_cents: null,
}

describe("priceDisplay", () => {
  it("uses the selling price for a simple product", () => {
    expect(priceDisplay(simple)).toEqual({
      kind: "single",
      sellingCents: 2000,
      compareAtCents: null,
    })
  })

  it("carries the strikethrough when a sale is active", () => {
    expect(
      priceDisplay({
        ...simple,
        selling_price_cents: 1500,
        compare_at_price_cents: 2000,
      }),
    ).toEqual({ kind: "single", sellingCents: 1500, compareAtCents: 2000 })
  })

  it("shows a variable product as a range", () => {
    expect(
      priceDisplay({
        ...simple,
        product_type: "VARIABLE",
        min_price_cents: 1000,
        max_price_cents: 3000,
      }),
    ).toEqual({ kind: "range", minCents: 1000, maxCents: 3000 })
  })

  it("collapses a variable product whose variations share one price", () => {
    // A "From 20" on a product where every option costs 20 reads as a hedge.
    expect(
      priceDisplay({
        ...simple,
        product_type: "VARIABLE",
        selling_price_cents: null,
        min_price_cents: 2000,
        max_price_cents: 2000,
      }),
    ).toEqual({ kind: "single", sellingCents: 2000, compareAtCents: null })
  })

  it("prefers the variation floor over the parent row's own price", () => {
    // The parent's `price_cents` on a VARIABLE product is not a price anyone
    // can buy at.
    expect(
      priceDisplay({
        ...simple,
        product_type: "VARIABLE",
        price_cents: 9999,
        selling_price_cents: null,
        min_price_cents: 1000,
        max_price_cents: 1000,
      }),
    ).toEqual({ kind: "single", sellingCents: 1000, compareAtCents: null })
  })

  it("reports unpriced rather than rendering zero", () => {
    expect(
      priceDisplay({
        ...simple,
        price_cents: null,
        selling_price_cents: null,
      }),
    ).toEqual({ kind: "unpriced" })
  })

  it("treats a genuine zero price as a price", () => {
    expect(priceDisplay({ ...simple, selling_price_cents: 0 })).toEqual({
      kind: "single",
      sellingCents: 0,
      compareAtCents: null,
    })
  })
})

describe("stockState", () => {
  const tracked = {
    in_stock: true,
    quantity: 50,
    track_quantity: true,
    continue_selling_when_out_of_stock: false,
  }

  it("reports in stock when there is plenty", () => {
    expect(stockState(tracked)).toBe("in_stock")
  })

  it("reports low stock at or under the threshold", () => {
    expect(stockState({ ...tracked, quantity: 10 })).toBe("low_stock")
    expect(stockState({ ...tracked, quantity: 1 })).toBe("low_stock")
  })

  it("reports in stock when the vendor is not tracking quantity", () => {
    expect(stockState({ ...tracked, track_quantity: false, quantity: 0 })).toBe(
      "in_stock",
    )
    // The flag stays false after tracking is turned off at zero. It is stale.
    expect(
      stockState({
        ...tracked,
        track_quantity: false,
        quantity: 0,
        in_stock: false,
      }),
    ).toBe("in_stock")
  })

  it("separates backorder from out of stock", () => {
    // Calling a backorder "in stock" is a delivery promise the shop never made.
    expect(
      stockState({
        ...tracked,
        quantity: 0,
        continue_selling_when_out_of_stock: true,
      }),
    ).toBe("backorder")
    expect(stockState({ ...tracked, quantity: 0 })).toBe("out_of_stock")
  })

  it("lets the API's in_stock veto everything", () => {
    expect(stockState({ ...tracked, in_stock: false })).toBe("out_of_stock")
  })
})

describe("isPurchasable", () => {
  it("allows a backorder", () => {
    expect(
      isPurchasable({
        in_stock: true,
        quantity: 0,
        track_quantity: true,
        continue_selling_when_out_of_stock: true,
      }),
    ).toBe(true)
  })

  it("refuses an out-of-stock product", () => {
    expect(
      isPurchasable({
        in_stock: false,
        quantity: 0,
        track_quantity: true,
        continue_selling_when_out_of_stock: false,
      }),
    ).toBe(false)
  })
})

describe("maxOrderableQuantity", () => {
  it("caps at the tracked quantity", () => {
    expect(
      maxOrderableQuantity({
        quantity: 3,
        track_quantity: true,
        continue_selling_when_out_of_stock: false,
      }),
    ).toBe(3)
  })

  it("is uncapped when quantity is not tracked", () => {
    // Guessing a ceiling here would refuse a sale the shop wanted to make.
    expect(
      maxOrderableQuantity({
        quantity: 0,
        track_quantity: false,
        continue_selling_when_out_of_stock: false,
      }),
    ).toBeNull()
  })

  it("is uncapped when backorders are accepted", () => {
    expect(
      maxOrderableQuantity({
        quantity: 0,
        track_quantity: true,
        continue_selling_when_out_of_stock: true,
      }),
    ).toBeNull()
  })

  it("never returns a negative cap", () => {
    expect(
      maxOrderableQuantity({
        quantity: -4,
        track_quantity: true,
        continue_selling_when_out_of_stock: false,
      }),
    ).toBe(0)
  })
})
