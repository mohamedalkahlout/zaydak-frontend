import { describe, expect, it } from "vitest"

import {
  dripBagLinesFromCart,
  dripCatalogueFromComposition,
  dripComposition,
} from "../drip-order"

const ids = new Map<string, string>([
  ["drip-pistachio", "p1"],
  ["drip-stracciatella", "p2"],
  ["drip-fondente", "p3"],
  ["drip-fragola", "p4"],
  ["drip-saffron", "p5"],
  ["drip-date", "p6"],
  ["drip-crown-pistachio", "c1"],
  ["drip-crown-cocoa", "c2"],
  ["drip-crown-rose", "c3"],
])

describe("dripComposition", () => {
  it("keeps scoop order and sorts crowns", () => {
    expect(
      dripComposition(
        { scoops: [0, 0, 4], crowns: ["rose", "pistachio"], quantity: 1, vessel: "cone" },
        ids,
      ),
    ).toEqual({
      parts: { flavour: ["p1", "p1", "p5"], crown: ["c1", "c3"] },
      vessel: "cone",
    })
  })

  it("omits an empty crown group and names a cup", () => {
    expect(
      dripComposition(
        { scoops: [5], crowns: [], quantity: 2, vessel: "cup" },
        ids,
      ),
    ).toEqual({
      parts: { flavour: ["p6"] },
      vessel: "cup",
    })
  })

  it("reads the assembled product instead of the sample slugs", () => {
    const built = dripCatalogueFromComposition({
      min_count: 1,
      max_count: 3,
      vessel_cap: 3,
      price_ladder_cents: [0, 1600, 2600, 3400],
      groups: [
        {
          key: "scoop",
          priced_by_ladder: true,
          addon_cents: 0,
          parts: [
            {
              product_id: "pist",
              addon_cents: 0,
              cutout_url: "https://cdn.example/pist.png",
              image_url: "https://cdn.example/pist-box.jpg",
              name: { en: "Pistachio", ar: "فستق" },
            },
          ],
        },
        {
          key: "topping",
          priced_by_ladder: false,
          addon_cents: 400,
          parts: [
            {
              product_id: "rose",
              addon_cents: 0,
              name: { en: "Rose", ar: "ورد" },
            },
          ],
        },
      ],
    })
    expect(built?.catalogue.flavours[0]?.cutout).toBe("https://cdn.example/pist.png")
    expect(built?.catalogue.price.scoops).toEqual([0, 16, 26, 34])
    expect(built?.catalogue.price.crownById).toEqual({ rose: 4 })
    expect(built?.catalogue.crowns[0]).toEqual({ id: "rose", src: undefined, en: "Rose", ar: "ورد" })
    expect(
      dripComposition(
        { scoops: [0], crowns: ["rose"], quantity: 1, vessel: "cup" },
        new Map(),
        built?.binding,
      ),
    ).toEqual({
      parts: { scoop: ["pist"], topping: ["rose"] },
      vessel: "cup",
    })
  })

  it("names a known topping sheet as its atlas", () => {
    const built = dripCatalogueFromComposition(
      {
        min_count: 1,
        max_count: 1,
        vessel_cap: 3,
        price_ladder_cents: [0, 1600],
        groups: [
          {
            key: "flavour",
            priced_by_ladder: true,
            addon_cents: 0,
            parts: [{ product_id: "pist", addon_cents: 0, name: { en: "Pistachio", ar: "فستق" } }],
          },
          {
            key: "crown",
            priced_by_ladder: false,
            addon_cents: 400,
            parts: [
              {
                product_id: "c1",
                addon_cents: 0,
                image_url: "https://cdn.example/bits-pistachio.webp",
                name: { en: "Pistachio crumble", ar: "فتات فستق" },
              },
              {
                product_id: "c2",
                addon_cents: 0,
                image_url: "https://cdn.example/custom.webp",
                name: { en: "Honeycomb", ar: "شهد" },
              },
              {
                product_id: "c3",
                addon_cents: 0,
                cutout_url: "https://cdn.example/rose-cut.png",
                image_url: "https://cdn.example/bits-rose.webp",
                name: { en: "Rose petals", ar: "بتلات ورد" },
              },
            ],
          },
        ],
      },
      new Map([["drip-crown-cocoa", "renamed"]]),
    )
    expect(built?.catalogue.crowns.map((crown) => ({
      id: crown.id,
      atlas: "atlas" in crown ? crown.atlas : undefined,
      src: "src" in crown ? crown.src : undefined,
    }))).toEqual([
      { id: "c1", atlas: "bits-pistachio", src: undefined },
      { id: "c2", atlas: undefined, src: "https://cdn.example/custom.webp" },
      { id: "c3", atlas: undefined, src: "https://cdn.example/rose-cut.png" },
    ])
  })

  it("matches a renamed topping by its slug", () => {
    const built = dripCatalogueFromComposition(
      {
        min_count: 1,
        max_count: 1,
        vessel_cap: 3,
        price_ladder_cents: [0, 1600],
        groups: [
          {
            key: "flavour",
            priced_by_ladder: true,
            addon_cents: 0,
            parts: [{ product_id: "pist", addon_cents: 0, name: { en: "Pistachio", ar: "فستق" } }],
          },
          {
            key: "crown",
            priced_by_ladder: false,
            addon_cents: 400,
            parts: [
              {
                product_id: "renamed",
                addon_cents: 0,
                image_url: "https://cdn.example/bits-cocoa.webp",
                name: { en: "Dark shards", ar: "قطع" },
              },
            ],
          },
        ],
      },
      new Map([["drip-crown-cocoa", "renamed"]]),
    )
    const crown = built?.catalogue.crowns[0]
    expect(crown && "atlas" in crown ? crown.atlas : undefined).toBe("bits-cocoa")
    expect(crown && "src" in crown ? crown.src : undefined).toBeUndefined()
  })

  it("reads a stored cart line back into scoop indexes", () => {
    const binding = {
      flavourKey: "scoop",
      flavourIds: ["pist", "choc"],
      crownKey: "topping",
    }
    const composition = dripComposition(
      { scoops: [1, 0, 1], crowns: ["rose", "cocoa"], quantity: 2, vessel: "cup" },
      new Map(),
      binding,
    )
    expect(
      dripBagLinesFromCart(
        [
          {
            id: "line-1",
            product_id: "builder",
            quantity: 2,
            total_price_cents: 3400,
            composition,
          },
          {
            id: "other",
            product_id: "poster",
            quantity: 1,
            total_price_cents: 500,
            composition: null,
          },
        ],
        "builder",
        binding,
      ),
    ).toEqual([
      {
        id: "line-1",
        scoops: [1, 0, 1],
        crowns: ["cocoa", "rose"],
        quantity: 2,
        vessel: "cup",
        totalCents: 3400,
      },
    ])
  })

  it("keeps a cart line whose composition arrived as a string", () => {
    const binding = {
      flavourKey: "scoop",
      flavourIds: ["pist"],
      crownKey: null,
    }
    expect(
      dripBagLinesFromCart(
        [
          {
            id: "line-2",
            product_id: "builder",
            quantity: 1,
            total_price_cents: 1600,
            composition: JSON.stringify({
              parts: { scoop: ["pist", "missing"] },
              vessel: "cone",
            }),
          },
        ],
        "builder",
        binding,
      ),
    ).toEqual([
      {
        id: "line-2",
        scoops: [0],
        crowns: [],
        quantity: 1,
        vessel: "cone",
        totalCents: 1600,
      },
    ])
  })

  it("refuses a scoop the catalogue does not have", () => {
    expect(
      dripComposition(
        { scoops: [0], crowns: [], quantity: 1, vessel: "cone" },
        new Map(),
      ),
    ).toBeNull()
  })
})