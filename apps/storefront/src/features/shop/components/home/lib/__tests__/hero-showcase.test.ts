import { describe, expect, it } from "vitest"

import { buildHeroShowcase, rankShowcaseCandidates } from "../hero-showcase"
import type { ProductCard } from "@/features/catalog/lib/product"

/**
 * The marquee's candidates are the popular-then-newest rails, re-ranked:
 * buyable before sold out, and a light boost for a buyable markdown. The rank
 * is pinned as a pure function because the band is server-rendered and must
 * hydrate to the same frames — so nothing here may depend on anything but the
 * input order.
 */

function product(
  overrides: Partial<ProductCard> & { id: string },
): ProductCard {
  return {
    __typename: "PublicProduct",
    name: { en: overrides.id },
    slug: overrides.id,
    image: { original: `/${overrides.id}.jpg` },
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

const soldOut = { in_stock: false, quantity: 0 }
const onSale = { selling_price_cents: 7000, compare_at_price_cents: 10000 }

const ids = (products: ProductCard[]) => products.map((p) => p.id)

describe("rankShowcaseCandidates", () => {
  it("leaves a list of buyable full-price products exactly as given", () => {
    const input = ["a", "b", "c", "d", "e"].map((id) => product({ id }))
    expect(ids(rankShowcaseCandidates(input))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ])
  })

  it("moves sold-out products last, keeping both groups in their order", () => {
    const input = [
      product({ id: "gone-1", ...soldOut }),
      product({ id: "a" }),
      product({ id: "gone-2", ...soldOut }),
      product({ id: "b" }),
    ]
    expect(ids(rankShowcaseCandidates(input))).toEqual([
      "a",
      "b",
      "gone-1",
      "gone-2",
    ])
  })

  it("counts a backorder as buyable", () => {
    const input = [
      product({ id: "gone", ...soldOut }),
      product({
        id: "backorder",
        quantity: 0,
        continue_selling_when_out_of_stock: true,
      }),
    ]
    expect(ids(rankShowcaseCandidates(input))).toEqual(["backorder", "gone"])
  })

  it("ranks a buyable markdown four places earlier, behind what stands there", () => {
    const input = [
      ...["p0", "p1", "p2", "p3", "p4", "p5"].map((id) => product({ id })),
      product({ id: "sale-6", ...onSale }),
    ]
    // Index 6 ranks as 2, and the product already at 2 keeps its place.
    expect(ids(rankShowcaseCandidates(input))).toEqual([
      "p0",
      "p1",
      "p2",
      "sale-6",
      "p3",
      "p4",
      "p5",
    ])
  })

  it("keeps the boost light: a deep markdown does not reach the front", () => {
    const input = [
      ...Array.from({ length: 12 }, (_, i) => product({ id: `p${i}` })),
      product({ id: "sale-12", ...onSale }),
    ]
    const ranked = ids(rankShowcaseCandidates(input))
    expect(ranked.indexOf("sale-12")).toBe(9)
    expect(ranked.slice(0, 9)).toEqual(
      Array.from({ length: 9 }, (_, i) => `p${i}`),
    )
  })

  it("keeps markdowns in their own order relative to each other", () => {
    const input = [
      product({ id: "p0" }),
      product({ id: "sale-a", ...onSale }),
      product({ id: "sale-b", ...onSale }),
    ]
    expect(ids(rankShowcaseCandidates(input))).toEqual([
      "sale-a",
      "sale-b",
      "p0",
    ])
  })

  it("gives a sold-out markdown no boost", () => {
    const input = [
      product({ id: "p0" }),
      product({ id: "sold-sale", ...soldOut, ...onSale }),
    ]
    expect(ids(rankShowcaseCandidates(input))).toEqual(["p0", "sold-sale"])
  })

  it("is deterministic: the same input gives the same order every time", () => {
    const input = [
      product({ id: "gone", ...soldOut }),
      product({ id: "a" }),
      product({ id: "sale", ...onSale }),
      product({ id: "b" }),
    ]
    const first = ids(rankShowcaseCandidates(input))
    for (let i = 0; i < 5; i++) {
      expect(ids(rankShowcaseCandidates(input))).toEqual(first)
    }
    // And the input itself is not reordered in place.
    expect(ids(input)).toEqual(["gone", "a", "sale", "b"])
  })
})

describe("buildHeroShowcase", () => {
  it("leads the band with buyable products and puts sold-out frames last", () => {
    const items = buildHeroShowcase(
      [
        product({ id: "gone", ...soldOut }),
        product({ id: "a" }),
        product({ id: "b" }),
        product({ id: "c" }),
      ],
      { base: "/acme", locale: "en", cover: null },
    )
    expect(items.map((i) => i.href)).toEqual([
      "/acme/products/a",
      "/acme/products/b",
      "/acme/products/c",
      "/acme/products/gone",
    ])
  })

  it("keeps the buyable twin when two products share one photograph", () => {
    const items = buildHeroShowcase(
      [
        product({ id: "gone", ...soldOut, image: { original: "/mug.jpg" } }),
        product({ id: "buyable", image: { original: "/mug.jpg" } }),
        product({ id: "b" }),
        product({ id: "c" }),
      ] as ProductCard[],
      { base: "/acme", locale: "en", cover: null },
    )
    expect(items.map((i) => i.id)).toEqual(["buyable", "b", "c"])
  })
})
