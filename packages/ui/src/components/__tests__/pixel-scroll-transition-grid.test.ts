import { describe, expect, it } from "vitest"
import {
  accentBandWidth,
  ACCENT_BAND,
  buildGrid,
  CELL_BASE,
  CELL_TARGET,
  classifyCell,
  clamp01,
  directionValue,
  EASINGS,
  hash2d,
  patternValue,
  PIXEL_DIRECTIONS,
  PIXEL_EASINGS,
  PIXEL_PATTERNS,
  scrollProgress,
  shapeProgress,
  type BuildGridOptions,
} from "../pixel-scroll-transition-grid"

const baseGrid: BuildGridOptions = {
  width: 240,
  height: 160,
  pixelSize: 20,
  gap: 0,
  direction: "bottom-top",
  pattern: "random",
  patternIntensity: 0.4,
  accentShare: 0.15,
  accentCount: 4,
}

describe("hash2d", () => {
  it("stays inside [0, 1)", () => {
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        const h = hash2d(x, y, 7)
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThan(1)
      }
    }
  })

  /**
   * The whole point of hashing rather than `Math.random()`: the grid is rebuilt
   * on every resize, and an unstable hash would reshuffle the pattern under the
   * reader mid-scroll.
   */
  it("is deterministic per cell and per seed", () => {
    expect(hash2d(3, 9, 1)).toBe(hash2d(3, 9, 1))
    expect(hash2d(3, 9, 1)).not.toBe(hash2d(9, 3, 1))
    expect(hash2d(3, 9, 1)).not.toBe(hash2d(3, 9, 2))
  })

  it("spreads roughly evenly across the range", () => {
    const buckets = new Array<number>(10).fill(0)
    for (let x = 0; x < 60; x++) {
      for (let y = 0; y < 60; y++) {
        buckets[Math.floor(hash2d(x, y, 0) * 10)]! += 1
      }
    }
    // 3600 samples over 10 buckets; a clumped hash would leave one near-empty.
    for (const count of buckets) expect(count).toBeGreaterThan(200)
  })
})

describe("directionValue", () => {
  it("orders the axis each direction names", () => {
    const at = (col: number, row: number, d: (typeof PIXEL_DIRECTIONS)[number]) =>
      directionValue(col, row, 5, 5, d)

    expect(at(0, 0, "top-bottom")).toBeLessThan(at(0, 4, "top-bottom"))
    expect(at(0, 4, "bottom-top")).toBeLessThan(at(0, 0, "bottom-top"))
    expect(at(0, 0, "left-right")).toBeLessThan(at(4, 0, "left-right"))
    expect(at(4, 0, "right-left")).toBeLessThan(at(0, 0, "right-left"))
    // Centre of a 5x5 is (2, 2).
    expect(at(2, 2, "center-out")).toBeLessThan(at(0, 0, "center-out"))
    expect(at(0, 0, "center-in")).toBeLessThan(at(2, 2, "center-in"))
  })

  it("spans the full range and never leaves it", () => {
    for (const direction of PIXEL_DIRECTIONS) {
      let min = Infinity
      let max = -Infinity
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const v = directionValue(col, row, 9, 9, direction)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
          min = Math.min(min, v)
          max = Math.max(max, v)
        }
      }
      expect(min).toBeCloseTo(0, 5)
      expect(max).toBeCloseTo(1, 5)
    }
  })

  it("survives a single-column or single-row grid", () => {
    for (const direction of PIXEL_DIRECTIONS) {
      expect(Number.isFinite(directionValue(0, 0, 1, 1, direction))).toBe(true)
      expect(Number.isFinite(directionValue(0, 3, 1, 6, direction))).toBe(true)
    }
  })
})

describe("patternValue", () => {
  it("stays inside [0, 1] for every pattern", () => {
    for (const pattern of PIXEL_PATTERNS) {
      for (let row = 0; row < 17; row++) {
        for (let col = 0; col < 23; col++) {
          const v = patternValue(col, row, 23, 17, pattern)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  /**
   * `radial` is concentric rings, not distance-from-centre — distance is what
   * the `center-out` *direction* already gives, and a pattern identical to a
   * direction would blend into nothing.
   */
  it("keeps radial distinct from the center-out direction", () => {
    let differs = false
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const p = patternValue(col, row, 15, 15, "radial")
        const d = directionValue(col, row, 15, 15, "center-out")
        if (Math.abs(p - d) > 0.05) differs = true
      }
    }
    expect(differs).toBe(true)
  })

  it("alternates the checker between neighbours", () => {
    // The blend is 0.75 checker + 0.25 noise, so neighbours always straddle the
    // midpoint even at the noisiest.
    const even = patternValue(4, 4, 20, 20, "checker")
    const odd = patternValue(5, 4, 20, 20, "checker")
    expect(even).toBeLessThan(0.5)
    expect(odd).toBeGreaterThan(0.5)
  })

  it("is resolution-independent for the continuous patterns", () => {
    // Same relative position in two differently-sized grids.
    for (const pattern of ["wave", "spiral", "radial", "diagonal"] as const) {
      expect(patternValue(5, 5, 11, 11, pattern)).toBeCloseTo(
        patternValue(10, 10, 21, 21, pattern),
        5,
      )
    }
  })
})

describe("buildGrid", () => {
  it("covers the box, including a partial trailing cell", () => {
    const grid = buildGrid({ ...baseGrid, width: 245, height: 161, pixelSize: 20 })
    expect(grid.cols).toBe(13) // ceil(245 / 20)
    expect(grid.rows).toBe(9) // ceil(161 / 20)
    expect(grid.thresholds).toHaveLength(13 * 9)
  })

  it("accounts for the gap in the step but not in the painted size", () => {
    const grid = buildGrid({ ...baseGrid, width: 200, pixelSize: 20, gap: 5 })
    expect(grid.size).toBe(20)
    expect(grid.step).toBe(25)
    expect(grid.cols).toBe(8) // ceil(200 / 25)
  })

  it("normalises thresholds so the wipe starts at 0 and finishes at 1", () => {
    for (const direction of PIXEL_DIRECTIONS) {
      for (const pattern of PIXEL_PATTERNS) {
        const { thresholds } = buildGrid({ ...baseGrid, direction, pattern })
        let min = Infinity
        let max = -Infinity
        for (const t of thresholds) {
          min = Math.min(min, t)
          max = Math.max(max, t)
        }
        expect(min).toBeCloseTo(0, 5)
        expect(max).toBeCloseTo(1, 5)
      }
    }
  })

  it("puts the named direction in charge at low pattern intensity", () => {
    const { cols, rows, thresholds } = buildGrid({
      ...baseGrid,
      direction: "top-bottom",
      patternIntensity: 0.1,
    })
    const rowMean = (row: number) => {
      let sum = 0
      for (let col = 0; col < cols; col++) sum += thresholds[row * cols + col]!
      return sum / cols
    }
    expect(rowMean(0)).toBeLessThan(rowMean(rows - 1))
  })

  it("hands the reveal entirely to the pattern at intensity 1", () => {
    const viaPattern = buildGrid({
      ...baseGrid,
      direction: "top-bottom",
      pattern: "diagonal",
      patternIntensity: 1,
    })
    const otherDirection = buildGrid({
      ...baseGrid,
      direction: "center-out",
      pattern: "diagonal",
      patternIntensity: 1,
    })
    expect(Array.from(viaPattern.thresholds)).toEqual(
      Array.from(otherDirection.thresholds),
    )
  })

  it("marks roughly accentShare of the cells, drawn from the whole palette", () => {
    const { accents } = buildGrid({
      ...baseGrid,
      width: 1200,
      height: 800,
      pixelSize: 10,
      accentShare: 0.15,
      accentCount: 4,
    })
    const marked = accents.reduce((n, a) => (a >= 0 ? n + 1 : n), 0)
    expect(marked / accents.length).toBeCloseTo(0.15, 1)

    const used = new Set(Array.from(accents).filter((a) => a >= 0))
    expect(used).toEqual(new Set([0, 1, 2, 3]))
  })

  it("marks nothing when there is no palette or no share", () => {
    for (const options of [
      { accentCount: 0 },
      { accentShare: 0 },
    ] as Partial<BuildGridOptions>[]) {
      const { accents } = buildGrid({ ...baseGrid, ...options })
      expect(Array.from(accents).every((a) => a === -1)).toBe(true)
    }
  })

  it("keeps the accent index inside the palette", () => {
    const { accents } = buildGrid({
      ...baseGrid,
      accentShare: 1,
      accentCount: 1,
    })
    expect(Array.from(accents).every((a) => a === 0)).toBe(true)
  })

  it("clamps out-of-range inputs instead of producing NaN cells", () => {
    const grid = buildGrid({
      ...baseGrid,
      width: 0,
      height: -10,
      pixelSize: 0,
      gap: -8,
      patternIntensity: 4,
      accentShare: 9,
    })
    expect(grid.cols).toBe(1)
    expect(grid.rows).toBe(1)
    expect(grid.size).toBe(1)
    expect(Array.from(grid.thresholds).every(Number.isFinite)).toBe(true)
  })

  /** A uniform grid has no spread to stretch; it must not divide by zero. */
  it("falls back to an immediate reveal when every cell ties", () => {
    const { thresholds } = buildGrid({
      ...baseGrid,
      width: 20,
      height: 20,
      pixelSize: 20,
    })
    expect(Array.from(thresholds)).toEqual([0])
  })

  it("rebuilds identically for the same inputs", () => {
    const a = buildGrid(baseGrid)
    const b = buildGrid(baseGrid)
    expect(Array.from(a.thresholds)).toEqual(Array.from(b.thresholds))
    expect(Array.from(a.accents)).toEqual(Array.from(b.accents))
  })
})

describe("shapeProgress", () => {
  const linear = { endAt: 1, scrollInfluence: 1, easing: "linear" } as const

  it("passes progress through untouched at its neutral settings", () => {
    expect(shapeProgress(0, linear)).toBe(0)
    expect(shapeProgress(0.37, linear)).toBeCloseTo(0.37, 6)
    expect(shapeProgress(1, linear)).toBe(1)
  })

  it("finishes early at a lower endAt", () => {
    expect(shapeProgress(0.85, { ...linear, endAt: 0.85 })).toBe(1)
    expect(shapeProgress(0.425, { ...linear, endAt: 0.85 })).toBeCloseTo(0.5, 6)
  })

  it("bends the curve with scrollInfluence while pinning both ends", () => {
    const slow = { ...linear, scrollInfluence: 1.5 }
    const fast = { ...linear, scrollInfluence: 0.5 }
    expect(shapeProgress(0, slow)).toBe(0)
    expect(shapeProgress(1, slow)).toBe(1)
    expect(shapeProgress(0.5, slow)).toBeLessThan(0.5)
    expect(shapeProgress(0.5, fast)).toBeGreaterThan(0.5)
  })

  it("applies each easing on top", () => {
    for (const easing of PIXEL_EASINGS) {
      expect(shapeProgress(0, { ...linear, easing })).toBe(0)
      expect(shapeProgress(1, { ...linear, easing })).toBe(1)
    }
    expect(shapeProgress(0.5, { ...linear, easing: "ease-in" })).toBeCloseTo(0.25, 6)
    expect(shapeProgress(0.5, { ...linear, easing: "ease-out" })).toBeCloseTo(0.75, 6)
  })

  it("never escapes [0, 1], however bad the inputs", () => {
    const bad = [
      { raw: 2, shape: linear },
      { raw: -3, shape: linear },
      { raw: 0.5, shape: { ...linear, endAt: 0 } },
      { raw: 0, shape: { ...linear, endAt: 0 } },
      { raw: 0.5, shape: { ...linear, scrollInfluence: 0 } },
      { raw: 0.5, shape: { ...linear, scrollInfluence: -2 } },
      { raw: Number.NaN, shape: linear },
    ]
    for (const { raw, shape } of bad) {
      const p = shapeProgress(raw, shape)
      expect(Number.isFinite(p)).toBe(true)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })

  it("keeps every easing monotonic", () => {
    for (const easing of PIXEL_EASINGS) {
      const curve = EASINGS[easing]
      for (let t = 0; t < 1; t += 0.05) {
        expect(curve(t + 0.05)).toBeGreaterThanOrEqual(curve(t) - 1e-9)
      }
    }
  })
})

describe("scrollProgress", () => {
  const VIEWPORT = 800

  describe("sticky", () => {
    // 200vh of root, 100vh pinned inside it: 800px of travel.
    const travel = (top: number) => scrollProgress("sticky", top, 1600, VIEWPORT)

    it("runs from the root reaching the top to the pin releasing", () => {
      expect(travel(0)).toBe(0)
      expect(travel(-400)).toBeCloseTo(0.5, 6)
      expect(travel(-800)).toBe(1)
    })

    it("clamps above and below the travel", () => {
      expect(travel(500)).toBe(0)
      expect(travel(-2000)).toBe(1)
    })

    it("reads a root with no travel as all-or-nothing", () => {
      expect(scrollProgress("sticky", 10, 400, VIEWPORT)).toBe(0)
      expect(scrollProgress("sticky", -10, 400, VIEWPORT)).toBe(1)
    })
  })

  describe("inline", () => {
    const travel = (top: number) => scrollProgress("inline", top, 900, VIEWPORT)

    it("runs from entering the bottom to leaving the top", () => {
      expect(travel(VIEWPORT)).toBe(0)
      expect(travel(-900)).toBe(1)
      // Halfway is the element straddling the viewport centre.
      expect(travel((VIEWPORT - 900) / 2)).toBeCloseTo(0.5, 6)
    })

    it("clamps outside the viewport", () => {
      expect(travel(5000)).toBe(0)
      expect(travel(-5000)).toBe(1)
    })

    it("returns 0 for a zero-sized viewport rather than NaN", () => {
      expect(scrollProgress("inline", 0, 0, 0)).toBe(0)
    })
  })
})

describe("accentBandWidth", () => {
  it("holds the full band through the middle of the wipe", () => {
    expect(accentBandWidth(0)).toBe(ACCENT_BAND)
    expect(accentBandWidth(0.5)).toBe(ACCENT_BAND)
  })

  /** Otherwise the finished state is a frozen scatter of colour, not flat colorB. */
  it("closes to nothing as the wipe completes", () => {
    expect(accentBandWidth(1)).toBe(0)
    expect(accentBandWidth(1.5)).toBe(0)
    expect(accentBandWidth(0.95)).toBeCloseTo(0.05, 6)
  })

  it("is off entirely at a zero max", () => {
    expect(accentBandWidth(0.5, 0)).toBe(0)
  })
})

describe("classifyCell", () => {
  const band = ACCENT_BAND

  it("holds a cell at colorA until progress passes its threshold", () => {
    expect(classifyCell(0.6, -1, 0.5, band)).toBe(CELL_BASE)
    expect(classifyCell(0.6, -1, 0.6, band)).toBe(CELL_BASE)
    expect(classifyCell(0.6, -1, 0.61, band)).toBe(CELL_TARGET)
  })

  it("reveals nothing at all at zero progress", () => {
    expect(classifyCell(0, -1, 0, band)).toBe(CELL_BASE)
    expect(classifyCell(0, 2, 0, band)).toBe(CELL_BASE)
  })

  /** Thresholds are normalised so the last cell sits at exactly 1. */
  it("reveals the final cell once progress reaches 1", () => {
    expect(classifyCell(1, -1, 1, 0)).toBe(CELL_TARGET)
  })

  it("flashes an accent only just behind the front", () => {
    expect(classifyCell(0.5, 2, 0.55, band)).toBe(2)
    expect(classifyCell(0.5, 2, 0.9, band)).toBe(CELL_TARGET)
  })

  it("ignores the accent index for unmarked cells and a closed band", () => {
    expect(classifyCell(0.5, -1, 0.55, band)).toBe(CELL_TARGET)
    expect(classifyCell(0.5, 2, 0.55, 0)).toBe(CELL_TARGET)
  })

  it("leaves every cell settled once the wipe is done", () => {
    for (const threshold of [0, 0.25, 0.9, 1]) {
      expect(classifyCell(threshold, 1, 1, accentBandWidth(1))).toBe(CELL_TARGET)
    }
  })
})

/**
 * The pieces above are each correct in isolation; this is the one property that
 * only shows up once they are composed — that scrolling actually wipes the
 * screen, in the direction asked for, and lands on a flat finished frame.
 */
describe("the composed reveal", () => {
  const frame = (raw: number, direction: BuildGridOptions["direction"]) => {
    const grid = buildGrid({ ...baseGrid, width: 720, height: 440, direction })
    const progress = shapeProgress(raw, {
      endAt: 0.85,
      scrollInfluence: 1.5,
      easing: "ease-out",
    })
    const band = accentBandWidth(progress)
    const states = Array.from(grid.thresholds, (t, i) =>
      classifyCell(t, grid.accents[i]!, progress, band),
    )
    return { grid, states }
  }

  const revealedShare = (states: number[]) =>
    states.filter((s) => s !== CELL_BASE).length / states.length

  it("sweeps from nothing to everything without ever going backwards", () => {
    let previous = -1
    for (const raw of [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
      const share = revealedShare(frame(raw, "bottom-top").states)
      expect(share).toBeGreaterThanOrEqual(previous)
      previous = share
    }
    expect(revealedShare(frame(0, "bottom-top").states)).toBe(0)
    expect(revealedShare(frame(1, "bottom-top").states)).toBe(1)
  })

  it("leads with the edge the direction names", () => {
    const { grid, states } = frame(0.3, "bottom-top")
    const half = Math.floor(grid.rows / 2)
    const shareOfRows = (from: number, to: number) => {
      const slice = states.slice(from * grid.cols, to * grid.cols)
      return revealedShare(slice)
    }
    expect(shareOfRows(half, grid.rows)).toBeGreaterThan(shareOfRows(0, half))
  })

  it("flashes accents mid-wipe and settles flat at the end", () => {
    const mid = frame(0.4, "bottom-top").states
    expect(mid.some((s) => s >= 0)).toBe(true)

    const done = frame(1, "bottom-top").states
    expect(done.every((s) => s === CELL_TARGET)).toBe(true)
  })
})

describe("clamp01", () => {
  it("bounds the range and swallows non-finite input", () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(Number.NaN)).toBe(0)
    expect(clamp01(Infinity)).toBe(0)
  })
})
