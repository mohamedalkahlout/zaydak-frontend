import { describe, expect, it } from "vitest"

import {
  defaultVariation,
  findVariation,
  reachableValues,
  selectionOf,
  type Variation,
} from "../variations"

/**
 * `PublicVariation.options` is `JSON` and both shapes below are live in the
 * database — the object form and the `{ name, value }` array form — so the
 * matcher has to handle each. These fixtures are deliberately in the two
 * different shapes rather than one.
 */
function variation(partial: Partial<Variation> & Pick<Variation, "id" | "options">): Variation {
  return {
    __typename: "PublicVariation",
    title: { en: partial.id },
    sku: null,
    image: null,
    price_cents: 1000,
    sale_price_cents: null,
    selling_price_cents: 1000,
    compare_at_price_cents: null,
    quantity: 5,
    is_disable: false,
    position: 0,
    ...partial,
  } as Variation
}

const objectShape = [
  variation({ id: "red-s", options: { Colour: "Red", Size: "S" }, position: 0 }),
  variation({ id: "red-m", options: { Colour: "Red", Size: "M" }, position: 1 }),
  variation({ id: "blue-s", options: { Colour: "Blue", Size: "S" }, position: 2 }),
]

const arrayShape = [
  variation({
    id: "green-l",
    options: [
      { name: "Colour", value: "Green" },
      { name: "Size", value: "L" },
    ],
    position: 0,
  }),
]

describe("findVariation", () => {
  it("matches the object option shape", () => {
    expect(
      findVariation(objectShape, { colour: "red", size: "m" })?.id,
    ).toBe("red-m")
  })

  it("matches the array option shape", () => {
    expect(
      findVariation(arrayShape, { colour: "green", size: "l" })?.id,
    ).toBe("green-l")
  })

  it("is case-insensitive on both the option name and its value", () => {
    // The option definition and the variation row are written by two different
    // code paths and agree on spelling only by convention.
    expect(findVariation(objectShape, { COLOUR: "RED", Size: "s" })?.id).toBe(
      "red-s",
    )
  })

  it("returns null when no variation has that combination", () => {
    expect(findVariation(objectShape, { colour: "blue", size: "m" })).toBeNull()
  })

  it("returns null for an empty selection rather than the first row", () => {
    expect(findVariation(objectShape, {})).toBeNull()
  })
})

describe("reachableValues", () => {
  it("narrows the second option to what the first allows", () => {
    // Blue only exists in S, so picking Blue must grey out M.
    expect([...reachableValues(objectShape, "Size", { colour: "blue" })]).toEqual([
      "s",
    ])
  })

  it("offers every value of an option when nothing else is chosen", () => {
    expect([...reachableValues(objectShape, "Size", {})].sort()).toEqual(["m", "s"])
  })

  it("ignores its own option when narrowing", () => {
    // Picking a Size must not shrink the list of Sizes to the one already on.
    expect(
      [...reachableValues(objectShape, "Size", { size: "s" })].sort(),
    ).toEqual(["m", "s"])
  })

  it("excludes variations the vendor disabled", () => {
    const withDisabled = [
      ...objectShape,
      variation({ id: "blue-m", options: { Colour: "Blue", Size: "M" }, is_disable: true }),
    ]
    expect([...reachableValues(withDisabled, "Size", { colour: "blue" })]).toEqual([
      "s",
    ])
  })
})

describe("defaultVariation", () => {
  it("opens on the first in-stock variation by position", () => {
    const rows = [
      variation({ id: "sold-out", options: {}, position: 0, quantity: 0 }),
      variation({ id: "available", options: {}, position: 1, quantity: 3 }),
    ]
    expect(defaultVariation(rows)?.id).toBe("available")
  })

  it("falls back to an enabled but sold-out variation", () => {
    const rows = [variation({ id: "only", options: {}, quantity: 0 })]
    expect(defaultVariation(rows)?.id).toBe("only")
  })

  it("returns null when there are none", () => {
    expect(defaultVariation([])).toBeNull()
  })
})

describe("selectionOf", () => {
  it("lowercases both sides so it feeds straight back into findVariation", () => {
    const selection = selectionOf(objectShape[0]!)
    expect(selection).toEqual({ colour: "red", size: "s" })
    expect(findVariation(objectShape, selection)?.id).toBe("red-s")
  })
})
