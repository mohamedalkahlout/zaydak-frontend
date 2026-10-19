import { describe, expect, it } from "vitest"

import { handoffOffset, mobileFocus, springStep } from "../motion"

describe("mobile rail motion", () => {
  it("settles a short flick onto the next piece", () => {
    expect(mobileFocus(2, 10, -30, -0.5, 200)).toBe(3)
    expect(mobileFocus(2, 10, 30, 0.5, 200)).toBe(1)
  })

  it("does not walk off either end", () => {
    expect(mobileFocus(0, 10, 80, 1, 200)).toBe(0)
    expect(mobileFocus(9, 10, -400, -1, 200)).toBe(9)
  })

  it("keeps the landing piece under the finger", () => {
    expect(handoffOffset(-40, 1, 2, 200)).toBe(160)
  })

  it("springs back to the middle", () => {
    let position = 160
    let velocity = 0
    for (let frame = 0; frame < 90; frame++) {
      const next = springStep(position, velocity, 0, 16)
      position = next.position
      velocity = next.velocity
    }
    expect(position).toBe(0)
    expect(velocity).toBe(0)
  })
})
