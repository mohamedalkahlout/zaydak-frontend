import { describe, expect, it } from "vitest"
import {
  clamp01,
  columnDistance,
  columnWindow,
  hash,
  IDENTITY_POSE,
  SCATTER_LATEST_START,
  SCATTER_MAX_LENGTH,
  SCATTER_MIN_LENGTH,
  scatterPose,
  scatterWindow,
  windowProgress,
} from "../scroll-image-reveal-geometry"

/**
 * The component reads every number here during render, so the properties
 * pinned are the ones a browser would turn into a visible bug: a draw that
 * differs between two renders is a hydration mismatch, a window past
 * `settleAt` is a tile that never lands, and a column delay that is not
 * symmetric about the centre is a lopsided grid.
 */
describe("hash", () => {
  it("is deterministic and inside [0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const a = hash(i, 7, 3)
      expect(a).toBe(hash(i, 7, 3))
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(1)
    }
  })

  it("separates index, seed and salt", () => {
    expect(hash(1, 1, 1)).not.toBe(hash(2, 1, 1))
    expect(hash(1, 1, 1)).not.toBe(hash(1, 2, 1))
    expect(hash(1, 1, 1)).not.toBe(hash(1, 1, 2))
  })

  it("spreads across the range rather than clustering", () => {
    const draws = Array.from({ length: 64 }, (_, i) => hash(i, 1, 1))
    expect(Math.min(...draws)).toBeLessThan(0.15)
    expect(Math.max(...draws)).toBeGreaterThan(0.85)
  })
})

describe("clamp01", () => {
  it("pins to [0, 1] and refuses NaN and negative zero", () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(NaN)).toBe(0)
    expect(Object.is(clamp01(-0), 0)).toBe(true)
  })
})

describe("columnDistance", () => {
  it("is 0 at the centre and 1 at both edges of an odd grid", () => {
    expect(columnDistance(3, 7)).toBe(0)
    expect(columnDistance(0, 7)).toBe(1)
    expect(columnDistance(6, 7)).toBe(1)
    expect(columnDistance(2, 7)).toBeCloseTo(1 / 3)
    expect(columnDistance(4, 7)).toBeCloseTo(1 / 3)
  })

  it("shares the middle between the two centre columns of an even grid", () => {
    expect(columnDistance(1, 4)).toBeCloseTo(1 / 3)
    expect(columnDistance(2, 4)).toBeCloseTo(1 / 3)
    expect(columnDistance(0, 4)).toBe(1)
    expect(columnDistance(3, 4)).toBe(1)
  })

  it("treats a single column as the centre", () => {
    expect(columnDistance(0, 1)).toBe(0)
    expect(columnDistance(0, 0)).toBe(0)
  })
})

describe("columnWindow", () => {
  const options = { settleAt: 0.5, share: 0.6 }

  it("starts the centre column at 0 and lands the outer ones at settleAt", () => {
    expect(columnWindow(3, 7, options)).toEqual({ start: 0, end: 0.3 })
    const edge = columnWindow(0, 7, options)
    expect(edge.start).toBeCloseTo(0.2)
    expect(edge.end).toBeCloseTo(0.5)
  })

  it("gives every column the same travel length, delayed linearly", () => {
    const windows = Array.from({ length: 7 }, (_, c) => columnWindow(c, 7, options))
    for (const w of windows) expect(w.end - w.start).toBeCloseTo(0.3)
    const starts = windows.map((w) => w.start)
    // Symmetric about the centre…
    expect(starts[0]).toBeCloseTo(starts[6]!)
    expect(starts[1]).toBeCloseTo(starts[5]!)
    // …and evenly stepped out from it.
    expect(starts[1]! - starts[0]!).toBeCloseTo(starts[2]! - starts[1]!)
    expect(starts[2]! - starts[1]!).toBeCloseTo(starts[3]! - starts[2]!)
  })

  it("never runs past settleAt, whatever the share", () => {
    for (const share of [0.1, 0.6, 1, 1.5]) {
      for (let c = 0; c < 5; c++) {
        const w = columnWindow(c, 5, { settleAt: 0.4, share })
        expect(w.start).toBeGreaterThanOrEqual(0)
        expect(w.end).toBeLessThanOrEqual(0.4 + 1e-9)
        expect(w.end).toBeGreaterThanOrEqual(w.start)
      }
    }
  })

  it("collapses to an instant landing when settleAt is 0", () => {
    expect(columnWindow(0, 7, { settleAt: 0, share: 0.6 })).toEqual({
      start: 0,
      end: 0,
    })
  })
})

describe("scatterPose", () => {
  const options = { depth: 1000, tilt: 60 }

  it("is the same on every call for the same slot and seed", () => {
    expect(scatterPose(4, 1, options)).toEqual(scatterPose(4, 1, options))
  })

  it("changes with the seed and with the slot", () => {
    expect(scatterPose(4, 1, options)).not.toEqual(scatterPose(4, 2, options))
    expect(scatterPose(4, 1, options)).not.toEqual(scatterPose(5, 1, options))
  })

  it("always starts below the slot and behind the page", () => {
    for (let i = 0; i < 100; i++) {
      const pose = scatterPose(i, 3, options)
      expect(pose.y).toBeGreaterThanOrEqual(120)
      expect(pose.y).toBeLessThanOrEqual(400)
      expect(pose.z).toBeLessThanOrEqual(-300)
      expect(pose.z).toBeGreaterThanOrEqual(-1000)
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(80)
      expect(pose.rotateX).toBeGreaterThanOrEqual(24)
      expect(pose.rotateX).toBeLessThanOrEqual(60)
      expect(Math.abs(pose.rotateY)).toBeLessThanOrEqual(45)
      expect(Math.abs(pose.rotateZ)).toBeLessThanOrEqual(24)
    }
  })

  it("flattens to no depth and no turn when both are zero", () => {
    const pose = scatterPose(9, 1, { depth: 0, tilt: 0 })
    // `toBeCloseTo`, not `toBe`: a signed draw times zero is `-0`, which
    // serialises to "0" in a transform and is not worth a branch to avoid.
    expect(pose.z).toBeCloseTo(0)
    expect(pose.rotateX).toBeCloseTo(0)
    expect(pose.rotateY).toBeCloseTo(0)
    expect(pose.rotateZ).toBeCloseTo(0)
    // Position still scatters — depth and tilt are only the 3D half.
    expect(pose.y).toBeGreaterThan(0)
  })

  it("never starts at the identity, which would be a tile that does not move", () => {
    for (let i = 0; i < 50; i++) {
      expect(scatterPose(i, 1, options)).not.toEqual(IDENTITY_POSE)
    }
  })
})

describe("scatterWindow", () => {
  it("keeps every tile inside [0, settleAt] with a real travel", () => {
    for (let i = 0; i < 100; i++) {
      const w = scatterWindow(i, 5, { settleAt: 0.5 })
      expect(w.start).toBeGreaterThanOrEqual(0)
      expect(w.start).toBeLessThanOrEqual(SCATTER_LATEST_START * 0.5)
      expect(w.end).toBeLessThanOrEqual(0.5)
      expect(w.end - w.start).toBeGreaterThanOrEqual(SCATTER_MIN_LENGTH * 0.5 - 1e-9)
    }
  })

  it("is bounded so the latest starter can still land on time", () => {
    // The worst case is the latest start with the longest length; the cap is
    // what keeps that tile from ending after settleAt.
    expect(SCATTER_LATEST_START + SCATTER_MAX_LENGTH).toBeGreaterThan(1)
    for (let i = 0; i < 100; i++) {
      expect(scatterWindow(i, 9, { settleAt: 1 }).end).toBeLessThanOrEqual(1)
    }
  })

  it("draws different windows for different tiles", () => {
    const a = scatterWindow(0, 1, { settleAt: 0.5 })
    const b = scatterWindow(1, 1, { settleAt: 0.5 })
    expect(a).not.toEqual(b)
  })
})

describe("windowProgress", () => {
  it("is 0 before the window, 1 after, and linear inside", () => {
    const w = { start: 0.2, end: 0.6 }
    expect(windowProgress(0, w)).toBe(0)
    expect(windowProgress(0.2, w)).toBe(0)
    expect(windowProgress(0.4, w)).toBeCloseTo(0.5)
    expect(windowProgress(0.6, w)).toBe(1)
    expect(windowProgress(1, w)).toBe(1)
  })

  it("lands instantly on a zero-width window instead of dividing by zero", () => {
    const w = { start: 0.3, end: 0.3 }
    expect(windowProgress(0.29, w)).toBe(0)
    expect(windowProgress(0.3, w)).toBe(1)
  })
})
