import { describe, expect, it } from "vitest"

import { isColorOption, swatchColor, swatchNeedsBorder } from "../colors"

/**
 * The swatch rule is the whole point of this module: a circle in the wrong
 * colour is worse than the word it replaced, so anything unrecognised has to
 * fall the whole option back to chips.
 */
describe("swatchColor", () => {
  it("resolves known names in either locale, ignoring case and padding", () => {
    expect(swatchColor("Black")).toBe("#111111")
    expect(swatchColor("  navy ")).toBe("#1f2a54")
    expect(swatchColor("أحمر")).toBe("#c02b1f")
  })

  it("returns null for anything it does not know", () => {
    expect(swatchColor("Greenish")).toBeNull()
    expect(swatchColor("")).toBeNull()
  })
})

describe("isColorOption", () => {
  it("accepts a colour option whose values all resolve", () => {
    expect(isColorOption("Color", ["Black", "White", "Navy"])).toBe(true)
    expect(isColorOption("اللون", ["أسود", "أبيض"])).toBe(true)
  })

  it("refuses an option that is not named a colour", () => {
    expect(isColorOption("Size", ["Black", "White"])).toBe(false)
  })

  it("refuses the whole option when one value is unknown", () => {
    expect(isColorOption("Color", ["Black", "Greenish"])).toBe(false)
  })

  it("refuses an option with no values", () => {
    expect(isColorOption("Color", [])).toBe(false)
  })
})

describe("swatchNeedsBorder", () => {
  it("outlines the swatches that would vanish into the card", () => {
    expect(swatchNeedsBorder("#ffffff")).toBe(true)
    expect(swatchNeedsBorder("#fffff0")).toBe(true)
  })

  it("leaves saturated and dark swatches unoutlined", () => {
    expect(swatchNeedsBorder("#111111")).toBe(false)
    expect(swatchNeedsBorder("#c02b1f")).toBe(false)
  })
})
