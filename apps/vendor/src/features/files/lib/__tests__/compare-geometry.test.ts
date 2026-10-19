import { describe, expect, it } from "vitest"
import {
  logicalPos,
  posForKey,
  revealClip,
} from "../compare-geometry"

const BOX = { left: 100, width: 200 }

describe("logicalPos", () => {
  it("measures from the left edge in LTR", () => {
    expect(logicalPos(100, BOX, false)).toBe(0)
    expect(logicalPos(200, BOX, false)).toBe(50)
    expect(logicalPos(300, BOX, false)).toBe(100)
  })

  it("measures from the right edge in RTL", () => {
    expect(logicalPos(100, BOX, true)).toBe(100)
    expect(logicalPos(200, BOX, true)).toBe(50)
    expect(logicalPos(300, BOX, true)).toBe(0)
  })

  it("mirrors LTR and RTL about the midpoint", () => {
    for (const x of [110, 150, 240, 290]) {
      expect(logicalPos(x, BOX, true)).toBeCloseTo(
        100 - logicalPos(x, BOX, false),
      )
    }
  })

  it("clamps a pointer dragged outside the box", () => {
    expect(logicalPos(-500, BOX, false)).toBe(0)
    expect(logicalPos(9999, BOX, false)).toBe(100)
    expect(logicalPos(-500, BOX, true)).toBe(100)
    expect(logicalPos(9999, BOX, true)).toBe(0)
  })

  it("does not divide by a zero-width box", () => {
    expect(logicalPos(50, { left: 0, width: 0 }, false)).toBe(0)
  })
})

describe("revealClip", () => {
  it("clips the trailing side in LTR", () => {
    expect(revealClip(30, false)).toBe("inset(0 70% 0 0)")
  })

  it("clips the leading side in RTL", () => {
    expect(revealClip(30, true)).toBe("inset(0 0 0 70%)")
  })

  it("hides the original at 0 and shows all of it at 100", () => {
    expect(revealClip(0, false)).toBe("inset(0 100% 0 0)")
    expect(revealClip(100, false)).toBe("inset(0 0% 0 0)")
    expect(revealClip(0, true)).toBe("inset(0 0 0 100%)")
    expect(revealClip(100, true)).toBe("inset(0 0 0 0%)")
  })
})

describe("posForKey", () => {
  it("grows toward the end with ArrowRight in LTR", () => {
    expect(posForKey("ArrowRight", 50, false)).toBe(55)
    expect(posForKey("ArrowLeft", 50, false)).toBe(45)
  })

  it("inverts the arrows in RTL", () => {
    expect(posForKey("ArrowRight", 50, true)).toBe(45)
    expect(posForKey("ArrowLeft", 50, true)).toBe(55)
  })

  it("moves the divider the same physical way in both directions", () => {
    // ArrowRight should reveal more of whatever sits on the right. In LTR that
    // is the enhanced side (pos grows); in RTL it is the original (pos shrinks).
    expect(posForKey("ArrowRight", 50, false)).toBeGreaterThan(50)
    expect(posForKey("ArrowRight", 50, true)).toBeLessThan(50)
  })

  it("keeps Home and End logical, not physical", () => {
    for (const rtl of [false, true]) {
      expect(posForKey("Home", 50, rtl)).toBe(0)
      expect(posForKey("End", 50, rtl)).toBe(100)
    }
  })

  it("clamps at the edges instead of running past them", () => {
    expect(posForKey("ArrowLeft", 2, false)).toBe(0)
    expect(posForKey("ArrowRight", 98, false)).toBe(100)
    expect(posForKey("ArrowRight", 2, true)).toBe(0)
    expect(posForKey("ArrowLeft", 98, true)).toBe(100)
  })

  it("returns null for a key it does not own", () => {
    expect(posForKey("Tab", 50, false)).toBeNull()
    expect(posForKey("a", 50, true)).toBeNull()
  })
})
