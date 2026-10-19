import { describe, expect, it } from "vitest"

import { fitRail, placeRail, railCenters, railFocusCenters } from "../layout"

describe("rail layout", () => {
  it("spaces a resting rail evenly", () => {
    expect(railCenters(800, 4, -1, 40, 160, 12)).toEqual([100, 300, 500, 700])
  })

  it("steps neighbours aside when one piece turns", () => {
    const resting = railCenters(500, 5, -1, 40, 180, 12)
    const turned = railCenters(500, 5, 2, 40, 180, 12)
    expect(turned[2]).toBe(resting[2])
    expect(resting[2]! - turned[1]!).toBeGreaterThan(resting[2]! - resting[1]!)
    expect(turned[3]! - resting[2]!).toBeGreaterThan(resting[3]! - resting[2]!)
  })

  it("keeps every piece inside the rack", () => {
    const fitted = fitRail({
      width: 640,
      count: 8,
      active: 3,
      gap: 18,
      maxHeight: 420,
      profileRatio: 0.22,
      frontRatio: 0.72,
    })
    expect(fitted.centers).toHaveLength(8)
    fitted.centers.forEach((center, index) => {
      const half = (index === 3 ? fitted.front : fitted.profile) / 2
      expect(center - half).toBeGreaterThanOrEqual(-1)
      expect(center + half).toBeLessThanOrEqual(641)
    })
  })

  it("does not shrink the rack when the first or last piece turns", () => {
    const input = {
      width: 900,
      count: 10,
      gap: 18,
      maxHeight: 420,
      profileRatio: 0.22,
      frontRatio: 0.72,
    }
    const resting = placeRail({ ...input, active: -1 })
    expect(placeRail({ ...input, active: 0 }).height).toBe(resting.height)
    expect(placeRail({ ...input, active: 9 }).height).toBe(resting.height)
  })

  it("parks the focused piece in the middle of a swipe rail", () => {
    expect(railFocusCenters(300, 3, 1, 100)).toEqual([50, 150, 250])
    expect(railFocusCenters(300, 3, 1, 100, 20)[1]).toBe(170)
  })
})
