import { describe, expect, it } from "vitest"
import {
  MAX_SCALE,
  MIN_SCALE,
  NUDGE_STEP,
  SHOT_SIZE,
  SOURCE_SIZE,
  boundsOf,
  clampScale,
  edgePath,
  fitViewport,
  layoutClusters,
  layoutGraph,
  nudgeForKey,
  toWorld,
  withOffset,
  zoomAt,
} from "../enhance-graph"

describe("layoutGraph", () => {
  it("centres the source on the world origin", () => {
    const { source } = layoutGraph(0)
    expect(source.x + source.w / 2).toBe(0)
    expect(source.y + source.h / 2).toBe(0)
    expect(source.w).toBe(SOURCE_SIZE)
  })

  it("returns no shot boxes for an empty run", () => {
    expect(layoutGraph(0).shots).toEqual([])
    expect(layoutGraph(-1).shots).toEqual([])
  })

  it("puts a lone shot on the source's midline", () => {
    const { source, shots } = layoutGraph(1)
    expect(shots).toHaveLength(1)
    expect(shots[0]!.y + shots[0]!.h / 2).toBe(source.y + source.h / 2)
  })

  it("centres the column, whatever the shot count", () => {
    for (const n of [1, 2, 3, 5]) {
      const mids = layoutGraph(n).shots.map((s) => s.y + s.h / 2)
      const mean = mids.reduce((a, b) => a + b, 0) / mids.length
      expect(mean).toBeCloseTo(0)
    }
  })

  it("stacks shots downward without overlapping", () => {
    const { shots } = layoutGraph(3)
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i]!.y).toBeGreaterThanOrEqual(
        shots[i - 1]!.y + shots[i - 1]!.h,
      )
    }
  })

  it("places every shot clear of the source's right edge", () => {
    const { source, shots } = layoutGraph(3)
    for (const s of shots) {
      expect(s.x).toBeGreaterThan(source.x + source.w)
      expect(s.w).toBe(SHOT_SIZE)
    }
  })

  it("never mirrors — the flow axis is content, so it is locale-free", () => {
    // Guards the house rule: there is no direction parameter to get wrong, and
    // repeated calls must be byte-identical regardless of the app's `dir`.
    expect(layoutGraph(2)).toEqual(layoutGraph(2))
    expect(layoutGraph(2).shots.every((s) => s.x > 0)).toBe(true)
  })
})

describe("withOffset", () => {
  it("shifts a box and leaves its size alone", () => {
    const box = { x: 10, y: 20, w: 30, h: 40 }
    expect(withOffset(box, 5, -7)).toEqual({ x: 15, y: 13, w: 30, h: 40 })
  })

  it("defaults to no shift", () => {
    const box = { x: 10, y: 20, w: 30, h: 40 }
    expect(withOffset(box)).toEqual(box)
  })
})

describe("edgePath", () => {
  const { source, shots } = layoutGraph(2)

  it("starts on the source's right edge and ends on the shot's left edge", () => {
    const d = edgePath(source, shots[0]!)
    expect(d).toMatch(
      new RegExp(`^M ${source.x + source.w} ${source.y + source.h / 2} C `),
    )
    expect(d.endsWith(`${shots[0]!.x} ${shots[0]!.y + shots[0]!.h / 2}`)).toBe(
      true,
    )
  })

  it("pulls both control points along the flow axis", () => {
    const d = edgePath(source, shots[0]!)
    const [c1x, c1y, c2x, c2y] = d
      .split("C ")[1]!
      .split(/[ ,]+/)
      .map(Number) as number[]
    // c1 sits ahead of the source anchor at the same height; c2 sits behind the
    // shot anchor at the shot's height. That is what keeps the fan readable.
    expect(c1x!).toBeGreaterThan(source.x + source.w)
    expect(c1y!).toBe(source.y + source.h / 2)
    expect(c2x!).toBeLessThan(shots[0]!.x)
    expect(c2y!).toBe(shots[0]!.y + shots[0]!.h / 2)
  })

  it("keeps a visible bow when a node is dragged behind the source", () => {
    const behind = withOffset(shots[0]!, -900, 0)
    const d = edgePath(source, behind)
    const c1x = Number(d.split("C ")[1]!.split(/[ ,]+/)[0])
    expect(c1x).toBeGreaterThanOrEqual(source.x + source.w + 56)
  })
})

describe("boundsOf", () => {
  it("returns a zero box for no boxes", () => {
    expect(boundsOf([])).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })

  it("wraps every box", () => {
    expect(
      boundsOf([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 30, y: -20, w: 10, h: 5 },
      ]),
    ).toEqual({ x: 0, y: -20, w: 40, h: 30 })
  })

  it("covers the whole laid-out graph", () => {
    const { source, shots } = layoutGraph(3)
    const b = boundsOf([source, ...shots])
    for (const box of [source, ...shots]) {
      expect(box.x).toBeGreaterThanOrEqual(b.x)
      expect(box.x + box.w).toBeLessThanOrEqual(b.x + b.w)
      expect(box.y).toBeGreaterThanOrEqual(b.y)
      expect(box.y + box.h).toBeLessThanOrEqual(b.y + b.h)
    }
  })
})

describe("fitViewport", () => {
  const content = { x: -100, y: -50, w: 200, h: 100 }

  it("centres the content in the stage", () => {
    const v = fitViewport(content, 800, 600)
    const cx = (content.x + content.w / 2) * v.scale + v.tx
    const cy = (content.y + content.h / 2) * v.scale + v.ty
    expect(cx).toBeCloseTo(400)
    expect(cy).toBeCloseTo(300)
  })

  it("never blows content up past its natural size", () => {
    expect(fitViewport(content, 4000, 4000).scale).toBe(1)
  })

  it("shrinks content that overflows, honouring the padding", () => {
    const big = { x: 0, y: 0, w: 2000, h: 100 }
    const v = fitViewport(big, 800, 600, 64)
    expect(v.scale).toBeCloseTo((800 - 128) / 2000)
    expect(big.w * v.scale).toBeLessThanOrEqual(800 - 128)
  })

  it("respects the scale floor rather than returning an unusable zoom", () => {
    const huge = { x: 0, y: 0, w: 100000, h: 100000 }
    expect(fitViewport(huge, 800, 600).scale).toBe(MIN_SCALE)
  })

  it("degrades to a centred identity viewport on a degenerate input", () => {
    // The stage is measured with a ResizeObserver, so the first paint really
    // does run with a 0x0 box — it must not produce NaN or Infinity.
    for (const v of [
      fitViewport(content, 0, 0),
      fitViewport({ x: 0, y: 0, w: 0, h: 0 }, 800, 600),
    ]) {
      expect(Number.isFinite(v.scale)).toBe(true)
      expect(Number.isFinite(v.tx)).toBe(true)
      expect(Number.isFinite(v.ty)).toBe(true)
      expect(v.scale).toBe(1)
    }
  })
})

describe("clampScale", () => {
  it("holds the zoom between its floor and ceiling", () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE)
    expect(clampScale(99)).toBe(MAX_SCALE)
    expect(clampScale(1.5)).toBe(1.5)
  })
})

describe("toWorld / zoomAt", () => {
  const v = { scale: 2, tx: 100, ty: 50 }

  it("inverts the world→screen mapping", () => {
    const w = toWorld(v, 300, 250)
    expect(w).toEqual({ x: 100, y: 100 })
    expect(w.x * v.scale + v.tx).toBe(300)
    expect(w.y * v.scale + v.ty).toBe(250)
  })

  it("pins the world point under the cursor while zooming", () => {
    const before = toWorld(v, 420, 310)
    const next = zoomAt(v, 1.2, 420, 310)
    expect(before.x * next.scale + next.tx).toBeCloseTo(420)
    expect(before.y * next.scale + next.ty).toBeCloseTo(310)
  })

  it("is a no-op at the limits, never a disguised pan", () => {
    const atMax = { scale: MAX_SCALE, tx: 10, ty: 20 }
    expect(zoomAt(atMax, 1.5, 300, 300)).toBe(atMax)
    const atMin = { scale: MIN_SCALE, tx: 10, ty: 20 }
    expect(zoomAt(atMin, 0.5, 300, 300)).toBe(atMin)
  })

  it("round-trips zoom in then out back to the same viewport", () => {
    const inn = zoomAt(v, 1.25, 400, 300)
    const out = zoomAt(inn, 1 / 1.25, 400, 300)
    expect(out.scale).toBeCloseTo(v.scale)
    expect(out.tx).toBeCloseTo(v.tx)
    expect(out.ty).toBeCloseTo(v.ty)
  })
})

describe("nudgeForKey", () => {
  it("moves along the physical axis the key names", () => {
    expect(nudgeForKey("ArrowRight")).toEqual({ dx: NUDGE_STEP, dy: 0 })
    expect(nudgeForKey("ArrowLeft")).toEqual({ dx: -NUDGE_STEP, dy: 0 })
    expect(nudgeForKey("ArrowUp")).toEqual({ dx: 0, dy: -NUDGE_STEP })
    expect(nudgeForKey("ArrowDown")).toEqual({ dx: 0, dy: NUDGE_STEP })
  })

  it("takes no locale argument — the nudge is identical in Arabic", () => {
    // The counterpart to `posForKey`, which *does* invert: that value is
    // logical, this one is a physical move on a content axis.
    expect(nudgeForKey).toHaveLength(1)
  })

  it("leaves keys it does not own to the browser", () => {
    for (const k of ["Home", "End", "Tab", "a", "Enter", " "]) {
      expect(nudgeForKey(k)).toBeNull()
    }
  })
})

describe("layoutClusters", () => {
  it("lays a single source out exactly as layoutGraph does", () => {
    // The one-image case must not be a special case — it is the batch case with
    // one entry, and any drift between the two would be a review that shifts
    // depending on how the run was started.
    for (const n of [0, 1, 3]) {
      const [cluster] = layoutClusters([n])
      expect(cluster).toEqual(layoutGraph(n))
    }
  })

  it("returns nothing for no sources", () => {
    expect(layoutClusters([])).toEqual([])
  })

  it("stacks clusters downward without overlapping", () => {
    const clusters = layoutClusters([3, 1, 2])
    const extent = (c: (typeof clusters)[number]) => {
      const boxes = [c.source, ...c.shots]
      return {
        top: Math.min(...boxes.map((b) => b.y)),
        bottom: Math.max(...boxes.map((b) => b.y + b.h)),
      }
    }
    for (let i = 1; i < clusters.length; i++) {
      // A cluster's arrow must never cross its neighbour's — that is what keeps
      // "this output came from that source" readable at twenty sources.
      expect(extent(clusters[i]!).top).toBeGreaterThan(
        extent(clusters[i - 1]!).bottom,
      )
    }
  })

  it("centres the whole stack on the origin", () => {
    const clusters = layoutClusters([2, 2, 2])
    const boxes = clusters.flatMap((c) => [c.source, ...c.shots])
    const top = Math.min(...boxes.map((b) => b.y))
    const bottom = Math.max(...boxes.map((b) => b.y + b.h))
    expect(top + bottom).toBeCloseTo(0)
  })

  it("keeps every cluster on the same flow axis", () => {
    // Clusters differ in `y` only. A cluster nudged sideways would read as a
    // different pipeline rather than a row of the same one.
    const clusters = layoutClusters([1, 3, 2])
    const xs = clusters.map((c) => c.source.x)
    expect(new Set(xs).size).toBe(1)
  })

  it("never mirrors, exactly like the single-cluster layout", () => {
    expect(layoutClusters([2, 2])).toEqual(layoutClusters([2, 2]))
    expect(
      layoutClusters([2, 2]).every((c) => c.shots.every((s) => s.x > 0)),
    ).toBe(true)
  })
})
