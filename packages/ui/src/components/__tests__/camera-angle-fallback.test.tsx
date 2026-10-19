import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"
import * as THREE from "three"
import { CameraAngleFallback } from "../camera-angle-fallback"

/**
 * The fallback exists to draw a picture, and jsdom has no pixels — so what is
 * pinned here is the geometry underneath it: does the light land where the
 * quaternion says it should, and does the globe read as glass — see-through,
 * with what is behind it dimmed and layered under the near face rather than
 * erased. A recording 2D context makes all of that answerable without a GPU or
 * a screenshot.
 */

const WIDTH = 300
const HEIGHT = 260
/**
 * Two things are painted a flat glow — the marker's core and the emitter's
 * lens — and the lens is always the later of the two, in both the in-front and
 * the behind-the-globe orders. Everything else glowing is a ramp.
 */
const isLens = (style: unknown) =>
  typeof style === "string" && style.startsWith("rgba(63, 185, 80,")
const alphaOf = (style: unknown) =>
  Number(String(style).split(",").pop()!.replace(")", ""))

/** The globe's on-screen footprint, derived the way the component derives it. */
const SCALE = HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(42) / 2)
const SILHOUETTE_PX = (SCALE * 0.82) / Math.sqrt(4.6 * 4.6 - 0.82 * 0.82)

type Arc = { x: number; y: number; r: number }
type Fill = { arc: Arc | null; style: unknown }

function recordingContext() {
  const fills: Fill[] = []
  /** Clip regions, as the circle that was in the path when `clip()` ran. */
  const clips: Arc[] = []
  let lastArc: Arc | null = null

  /** One shared sentinel — "this fill was a ramp, not a flat colour". */
  const gradient = { addColorStop: () => {} }
  const ctx = {
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    lineWidth: 1,
    globalCompositeOperation: "source-over",
    setTransform: () => {},
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {
      lastArc = null
    },
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    rect: () => {},
    arc: (x: number, y: number, r: number) => {
      lastArc = { x, y, r }
    },
    clip: () => {
      if (lastArc) clips.push(lastArc)
      fills.push({ arc: lastArc, style: "clip" })
    },
    fill: () => {
      fills.push({ arc: lastArc, style: ctx.fillStyle })
    },
    stroke: () => {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }

  return { ctx, fills, clips, gradient }
}

/** Mounts the fallback, runs exactly one frame, returns what it drew. */
function drawOneFrame(angle: { azimuth: number; elevation: number }) {
  const { ctx, fills, clips, gradient } = recordingContext()
  const frames: FrameRequestCallback[] = []

  vi.stubGlobal("Path2D", class {
    moveTo() {}
    lineTo() {}
  })
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width: WIDTH,
    height: HEIGHT,
    top: 0,
    left: 0,
    right: WIDTH,
    bottom: HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  const qy = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(angle.azimuth),
  )
  const qx = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(-angle.elevation),
  )
  const targetQuat = { current: qy.multiply(qx) }

  render(
    <CameraAngleFallback
      targetQuat={targetQuat}
      draggingRef={{ current: false }}
      spinRef={{ current: 0 }}
    />,
  )

  // The first scheduled callback is the render loop; one tick is a frame.
  act(() => frames[0]!(16))

  const lensAt = fills.findLastIndex((f) => isLens(f.style))
  // The glass is by far the widest thing painted — found by size rather than by
  // the radius under test, so the size assertion stays a real one.
  const glassAt = fills.reduce(
    (best, f, i) =>
      f.arc && f.arc.r > (fills[best]?.arc?.r ?? 0) ? i : best,
    -1,
  )

  return {
    fills,
    clips,
    gradient,
    /** The emitter's lens — the only thing filled in a flat glow. */
    lens: fills[lensAt]?.arc,
    lensAlpha: lensAt < 0 ? null : alphaOf(fills[lensAt]!.style),
    glass: fills[glassAt],
    /** Negative when the lens is painted under the glass, i.e. behind it. */
    lensOverGlass: lensAt - glassAt,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("<CameraAngleFallback />", () => {
  it("puts the light where the angle says, without a GPU", () => {
    // The quaternion is slerped toward its target, but it starts *at* it, so a
    // single frame already sits on the requested angle.
    const right = drawOneFrame({ azimuth: 90, elevation: 0 })
    expect(right.lens).toBeDefined()
    expect(right.lens!.x).toBeGreaterThan(WIDTH / 2)
    expect(right.lens!.y).toBeCloseTo(HEIGHT / 2, 0)

    const left = drawOneFrame({ azimuth: 270, elevation: 0 })
    expect(left.lens!.x).toBeLessThan(WIDTH / 2)

    const above = drawOneFrame({ azimuth: 0, elevation: 90 })
    expect(above.lens!.y).toBeLessThan(HEIGHT / 2)
    expect(above.lens!.x).toBeCloseTo(WIDTH / 2, 0)
  })

  it("paints the globe as glass, never as a solid", () => {
    // The lens and its halo are legitimately filled dead centre whenever the
    // light faces the camera, so the check is on size, not position: the only
    // thing the size of the globe is the fresnel ramp, and it is a ramp — a
    // flat colour there would be an opaque ball, and the panel behind it would
    // stop showing through.
    for (const azimuth of [0, 90, 180, 270]) {
      const frame = drawOneFrame({ azimuth, elevation: 0 })
      const globeSized = frame.fills.filter(
        (f) => f.arc !== null && f.arc.r > SILHOUETTE_PX / 2,
      )
      expect(globeSized).toHaveLength(1)
      expect(globeSized[0]!.style).toBe(frame.gradient)
    }
  })

  it("keeps the emitter on screen behind the globe, dimmed and underneath", () => {
    // This is the whole point of the glass: "back" is a direction the vendor
    // can pick, so the handle has to survive the trip round the far side. It
    // dims — that is the depth cue — but it never goes away, and it is painted
    // before the glass so it reads as being seen *through* it.
    const front = drawOneFrame({ azimuth: 0, elevation: 0 })
    expect(front.lensAlpha).toBe(1)
    expect(front.lensOverGlass).toBeGreaterThan(0)

    const behind = drawOneFrame({ azimuth: 180, elevation: 0 })
    expect(behind.lens).toBeDefined()
    expect(behind.lensOverGlass).toBeLessThan(0)
    expect(behind.lensAlpha!).toBeLessThan(1)
    // Dimmed, not erased — below this it stops being findable on a dark panel.
    expect(behind.lensAlpha!).toBeGreaterThan(0.5)

    // Nothing is clipped away any more; there is no hidden state left to hunt.
    expect(front.clips).toEqual([])
    expect(behind.clips).toEqual([])
  })

  it("sizes the globe to its perspective silhouette, not a naive divide", () => {
    const { glass } = drawOneFrame({ azimuth: 180, elevation: 0 })

    expect(glass?.arc).toBeDefined()
    expect(glass!.arc!.r).toBeCloseTo(SILHOUETTE_PX, 3)
    // The naive projection is visibly smaller; this is the check that it is
    // not what shipped.
    expect(glass!.arc!.r).toBeGreaterThan((SCALE * 0.82) / 4.6)
  })
})
