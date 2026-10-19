import { describe, expect, it } from "vitest"
import * as THREE from "three"
import {
  CAM_Z,
  EARTH_RADIUS,
  OUTER_RING_SCALE,
  PARALLAX_OFFSET,
  RING_SEGMENTS,
  RING_TUBE_SEGMENTS,
  RING_TUBE_SIDES,
  SPHERE_RADIUS,
  behindGlobeFactor,
  buildRingTube,
  distanceToSegment,
  nearestRingDistance,
  projectRing,
  projectX,
  projectY,
  silhouetteRadius,
  viewportScale,
} from "../camera-angle-geometry"

/**
 * The numbers both renderers agree on, and the two claims the ring shader is
 * built on top of: that the tube's cross-section is a real circle around the
 * spine, and that the emitter never moves in the ring's own frame.
 */

const HEIGHT = 260
const SCALE = viewportScale(HEIGHT)
/**
 * The buffers are `Float32Array` — the GPU's precision, not JavaScript's — so
 * six decimals is the whole budget and anything tighter is testing IEEE 754.
 */
const F32 = 5

describe("buildRingTube", () => {
  const R = SPHERE_RADIUS
  const tube = buildRingTube(R)
  const cols = RING_TUBE_SEGMENTS + 1
  const rows = RING_TUBE_SIDES + 1

  it("builds one duplicated column so the seam closes", () => {
    expect(tube.position).toHaveLength(cols * rows * 3)
    expect(tube.angle).toHaveLength(cols * rows)

    // First and last columns are the same ring of points, an angle apart of
    // exactly 2π — which is what keeps the dash pattern continuous across it.
    for (let j = 0; j < rows; j++) {
      const a = j * 3
      const b = (RING_TUBE_SEGMENTS * rows + j) * 3
      expect(tube.position[b]!).toBeCloseTo(tube.position[a]!, 10)
      expect(tube.position[b + 2]!).toBeCloseTo(tube.position[a + 2]!, 10)
    }
    expect(tube.angle[0]).toBe(0)
    expect(tube.angle[RING_TUBE_SEGMENTS * rows]).toBeCloseTo(Math.PI * 2, F32)
  })

  it("puts every spine vertex on the orbit circle", () => {
    for (let v = 0; v < cols * rows; v++) {
      const x = tube.position[v * 3]!
      const y = tube.position[v * 3 + 1]!
      const z = tube.position[v * 3 + 2]!
      expect(y).toBe(0)
      expect(Math.hypot(x, z)).toBeCloseTo(R, F32)
    }
  })

  it("gives every vertex a unit offset perpendicular to the tube", () => {
    for (let i = 0; i < cols; i++) {
      const a = (i / RING_TUBE_SEGMENTS) * Math.PI * 2
      // The tangent the tube runs along at this point.
      const tx = -Math.sin(a)
      const tz = Math.cos(a)
      for (let j = 0; j < rows; j++) {
        const v = i * rows + j
        const ox = tube.offset[v * 3]!
        const oy = tube.offset[v * 3 + 1]!
        const oz = tube.offset[v * 3 + 2]!
        // A unit circle in the plane the tube's cross-section lives in: if it
        // were not unit length the shader's radius would mean nothing, and if
        // it were not perpendicular the tube would shear as it thickened.
        expect(Math.hypot(ox, oy, oz)).toBeCloseTo(1, F32)
        expect(ox * tx + oz * tz).toBeCloseTo(0, F32)
      }
    }
  })

  it("indexes only vertices it built, two triangles a quad", () => {
    expect(tube.index).toHaveLength(RING_TUBE_SEGMENTS * RING_TUBE_SIDES * 6)
    let max = 0
    for (const i of tube.index) max = Math.max(max, i)
    expect(max).toBe(cols * rows - 1)
    // Uint16 is only safe while the whole tube fits in one.
    expect(cols * rows).toBeLessThan(65536)
  })
})

describe("behindGlobeFactor", () => {
  it("is 1 dead behind the globe and 0 dead in front of it", () => {
    expect(behindGlobeFactor(new THREE.Vector3(0, 0, -SPHERE_RADIUS))).toBeCloseTo(1, 6)
    expect(behindGlobeFactor(new THREE.Vector3(0, 0, SPHERE_RADIUS))).toBe(0)
  })

  it("is 0 clear of the silhouette, whichever side of the globe", () => {
    expect(behindGlobeFactor(new THREE.Vector3(SPHERE_RADIUS, 0, 0))).toBe(0)
    expect(behindGlobeFactor(new THREE.Vector3(0, SPHERE_RADIUS, 0))).toBe(0)
  })

  it("fades across the rim rather than stepping", () => {
    // Swept from behind-centre out past the silhouette, it has to pass through
    // values that are neither 0 nor 1 — a step here is a visible pop.
    const seen = new Set<string>()
    for (let x = 0; x <= EARTH_RADIUS * 1.4; x += EARTH_RADIUS / 40) {
      const f = behindGlobeFactor(new THREE.Vector3(x, 0, -SPHERE_RADIUS))
      if (f > 0.02 && f < 0.98) seen.add(f.toFixed(3))
    }
    expect(seen.size).toBeGreaterThan(3)
  })
})

describe("projection", () => {
  it("leaves the globe's centre put however far the eye leans", () => {
    expect(projectX(0, 0, SCALE, 150, PARALLAX_OFFSET)).toBeCloseTo(150, 10)
    expect(projectY(0, 0, SCALE, 130, PARALLAX_OFFSET)).toBeCloseTo(130, 10)
  })

  it("slides the near and far halves of the orbit past each other", () => {
    const shiftAt = (z: number) =>
      projectX(0.5, z, SCALE, 150, PARALLAX_OFFSET) - projectX(0.5, z, SCALE, 150, 0)
    const near = shiftAt(SPHERE_RADIUS)
    const far = shiftAt(-SPHERE_RADIUS)

    // The globe is what the eye stays fixed on, so the two halves of the orbit
    // slide in *opposite* directions around it — that counter-motion is the
    // depth cue, and it is the thing a static projection cannot fake.
    expect(Math.sign(near)).toBe(-Math.sign(far))
    // Nearer than the fixation point means moving more, as with any parallax.
    expect(Math.abs(near)).toBeGreaterThan(Math.abs(far))
    // And all of it stays imperceptible: half a degree is a pixel or two.
    expect(Math.abs(near)).toBeLessThan(4)
  })

  it("sizes the globe by its silhouette, not by a naive divide", () => {
    const naive = (SCALE * EARTH_RADIUS) / CAM_Z
    expect(silhouetteRadius(EARTH_RADIUS, SCALE)).toBeGreaterThan(naive)
  })
})

describe("ring hit-testing", () => {
  const x = new Float32Array(RING_SEGMENTS)
  const y = new Float32Array(RING_SEGMENTS)
  const fade = new Float32Array(RING_SEGMENTS)
  // Tipped face-on. Left as the identity the orbit is edge-on to the camera —
  // a horizontal line straight through the middle of the widget — which makes
  // "is the centre far from the ring" a question with a different answer.
  const faceOn = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2,
  )
  projectRing(faceOn, RING_SEGMENTS, SPHERE_RADIUS, SCALE, 150, 130, x, y, fade)

  it("measures to the segment, not just to the sample points", () => {
    // A point exactly between two samples is a miss for a point-to-point test
    // and a near-zero hit for a point-to-segment one.
    const mx = (x[0]! + x[1]!) / 2
    const my = (y[0]! + y[1]!) / 2
    expect(nearestRingDistance(mx, my, x, y, RING_SEGMENTS)).toBeLessThan(0.5)
    expect(Math.hypot(mx - x[0]!, my - y[0]!)).toBeGreaterThan(1)
  })

  it("reports the centre of the widget as far off the ring", () => {
    expect(nearestRingDistance(150, 130, x, y, RING_SEGMENTS)).toBeGreaterThan(20)
  })

  it("separates the two rings the vendor can grab", () => {
    const ox = new Float32Array(RING_SEGMENTS)
    const oy = new Float32Array(RING_SEGMENTS)
    projectRing(
      faceOn,
      RING_SEGMENTS,
      SPHERE_RADIUS * OUTER_RING_SCALE,
      SCALE,
      150,
      130,
      ox,
      oy,
      fade,
    )
    expect(nearestRingDistance(ox[0]!, oy[0]!, x, y, RING_SEGMENTS)).toBeGreaterThan(10)
  })

  it("finds an edge-on orbit right through the widget's centre", () => {
    const edgeOn = new THREE.Quaternion()
    const ex = new Float32Array(RING_SEGMENTS)
    const ey = new Float32Array(RING_SEGMENTS)
    projectRing(edgeOn, RING_SEGMENTS, SPHERE_RADIUS, SCALE, 150, 130, ex, ey, fade)
    expect(nearestRingDistance(150, 130, ex, ey, RING_SEGMENTS)).toBeLessThan(1)
  })

  it("clamps to the ends of a segment", () => {
    // Straight off the end of a horizontal segment, so the nearest point on it
    // is the endpoint rather than the perpendicular foot.
    expect(distanceToSegment(20, 0, 0, 0, 10, 0)).toBeCloseTo(10, 10)
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3, 10)
    expect(distanceToSegment(1, 1, 5, 5, 5, 5)).toBeCloseTo(Math.hypot(4, 4), 10)
  })
})
