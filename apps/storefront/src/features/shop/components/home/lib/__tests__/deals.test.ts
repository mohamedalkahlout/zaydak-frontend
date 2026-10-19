import { describe, expect, it } from "vitest"

import { MIN_DEALS, markdowns } from "../deals"
import type { ProductCard } from "@/features/catalog/lib/product"

/**
 * The markdown row is selected on the client because the API has no "on sale"
 * filter, which makes this function the only thing standing between the shopper
 * and a row headed "Marked down" full of things that are not.
 */

function product(overrides: Partial<ProductCard> & { id: string }): ProductCard {
  return {
    __typename: "PublicProduct",
    name: { en: overrides.id },
    slug: overrides.id,
    image: null,
    price_cents: 10000,
    sale_price_cents: null,
    selling_price_cents: 10000,
    compare_at_price_cents: null,
    min_price_cents: null,
    max_price_cents: null,
    product_type: "SIMPLE",
    in_stock: true,
    quantity: 5,
    track_quantity: true,
    continue_selling_when_out_of_stock: false,
    ...overrides,
  } as unknown as ProductCard
}

describe("markdowns", () => {
  it("keeps only products carrying a genuine price cut", () => {
    const result = markdowns(
      [
        product({ id: "full-price" }),
        product({
          id: "on-sale",
          selling_price_cents: 7000,
          compare_at_price_cents: 10000,
        }),
      ],
      10,
    )

    expect(result.map((p) => p.slug)).toEqual(["on-sale"])
  })

  it("ignores a compare-at price that is not actually higher", () => {
    // A vendor who typed the same number in both fields has not made a sale,
    // and `discountPercent` already refuses to render a badge for it.
    const result = markdowns(
      [
        product({
          id: "not-really",
          selling_price_cents: 10000,
          compare_at_price_cents: 10000,
        }),
        product({
          id: "backwards",
          selling_price_cents: 12000,
          compare_at_price_cents: 10000,
        }),
      ],
      10,
    )

    expect(result).toHaveLength(0)
  })

  it("skips a variable product showing a price range", () => {
    // A range has no single "was" to compare against, so labelling it a
    // markdown would be quoting a discount off a price nobody can buy at.
    const result = markdowns(
      [
        product({
          id: "variable",
          product_type: "VARIABLE",
          min_price_cents: 5000,
          max_price_cents: 9000,
          selling_price_cents: 5000,
          compare_at_price_cents: 12000,
        }),
      ],
      10,
    )

    expect(result).toHaveLength(0)
  })

  it("orders by the deepest cut, not by the order it was given", () => {
    const result = markdowns(
      [
        product({
          id: "ten-off",
          selling_price_cents: 9000,
          compare_at_price_cents: 10000,
        }),
        product({
          id: "half-off",
          selling_price_cents: 5000,
          compare_at_price_cents: 10000,
        }),
        product({
          id: "quarter-off",
          selling_price_cents: 7500,
          compare_at_price_cents: 10000,
        }),
      ],
      10,
    )

    expect(result.map((p) => p.slug)).toEqual([
      "half-off",
      "quarter-off",
      "ten-off",
    ])
  })

  it("honours the limit", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      product({
        id: `sale-${index}`,
        selling_price_cents: 9000 - index * 100,
        compare_at_price_cents: 10000,
      }),
    )

    expect(markdowns(many, 4)).toHaveLength(4)
  })

  it("drops a sold-out product, however deep the cut", () => {
    // A row headed "Marked down" is a row of things to buy.
    const result = markdowns(
      [
        product({
          id: "gone",
          in_stock: false,
          quantity: 0,
          selling_price_cents: 1000,
          compare_at_price_cents: 10000,
        }),
        product({
          id: "buyable",
          selling_price_cents: 9000,
          compare_at_price_cents: 10000,
        }),
      ],
      10,
    )

    expect(result.map((p) => p.slug)).toEqual(["buyable"])
  })

  it("keeps a backorderable product that is out of stock but still sellable", () => {
    // `continue_selling_when_out_of_stock` is the vendor saying they will take
    // the order, so the offer is real.
    const result = markdowns(
      [
        product({
          id: "backorder",
          quantity: 0,
          continue_selling_when_out_of_stock: true,
          selling_price_cents: 8000,
          compare_at_price_cents: 10000,
        }),
      ],
      10,
    )

    expect(result.map((p) => p.slug)).toEqual(["backorder"])
  })

  it("returns nothing for an empty page rather than throwing", () => {
    expect(markdowns([], 10)).toEqual([])
  })

  it("keeps MIN_DEALS above one, so the row is never a lonely single tile", () => {
    expect(MIN_DEALS).toBeGreaterThan(1)
  })
})
