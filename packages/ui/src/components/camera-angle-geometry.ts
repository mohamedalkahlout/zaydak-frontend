import * as THREE from 'three'

/**
 * The numbers the WebGL rig and the 2D fallback both have to agree on, and the
 * one piece of maths that is subtle enough that two copies of it would drift.
 *
 * Nothing here touches React or a rendering context, so it is unit-testable and
 * safe to import from either renderer.
 */

/** Camera distance on +Z, looking at the origin. */
export const CAM_Z = 4.6
/** Vertical field of view, in degrees. */
export const FOV_DEG = 42
/** The wire globe at the centre. */
export const EARTH_RADIUS = 0.82
/** The radius of the light's orbit around it. */
export const SPHERE_RADIUS = 1.55
/** Number of segments when drawing the orbit ring. */
export const RING_SEGMENTS = 64
/** Opacity multiplier applied to the back half of the orbit ring. */
export const RING_BACK_FADE = 0.28
/** The outer decorative ring is this factor times the primary orbit radius. */
export const OUTER_RING_SCALE = 1.3
/**
 * How many past emitter positions the motion trail remembers. At the fixed
 * sampling interval in `camera-angle-motion.ts` this is about a third of a
 * second of history.
 */
export const TRAIL_POINTS = 24
/** Radius of the glow marker dot in 3D world units. */
export const GLOW_MARKER_R = 0.045

/* ------------------------------------------------------------------ */
/* Orbit tube — the ring is a solid, so it can have a thickness         */
/* ------------------------------------------------------------------ */

/**
 * A `THREE.Line` is one pixel wide and cannot be anything else: `linewidth` is
 * a no-op on every WebGL backend. So the ring that has to get *fatter as it
 * comes toward the eye* cannot be a line — it is a tube, and these are its
 * dimensions.
 */
/** Cross-section resolution of the orbit tube. */
export const RING_TUBE_SIDES = 8
/**
 * Segments along the tube. Well past what the silhouette needs — the dash
 * pattern is a function of the arc angle interpolated across a segment, so the
 * segment count is what decides whether the dashes are evenly spaced.
 */
export const RING_TUBE_SEGMENTS = 128
/** Base tube radius in world units, before depth and band modulation. */
export const RING_TUBE_RADIUS = 0.0115
/** How many dashes the ring is broken into. */
export const RING_DASHES = 40

/** Eye-distance range the tube's thickness ramp is normalised over. */
export const RING_NEAR_MIN = CAM_Z - SPHERE_RADIUS * OUTER_RING_SCALE
export const RING_NEAR_MAX = CAM_Z + SPHERE_RADIUS * OUTER_RING_SCALE

/** How far off-axis the eye leans as the light travels, in degrees. */
export const PARALLAX_DEG = 0.5
/** That lean, as a world-space offset at the camera's distance. */
export const PARALLAX_OFFSET =
  CAM_Z * Math.tan(THREE.MathUtils.degToRad(PARALLAX_DEG))

/**
 * What the globe's wire keeps on the side facing away from the light. Low
 * enough that the terminator is a visible edge — the hemisphere the light
 * cannot reach has to read as being in shadow, not merely as less green.
 */
export const WIRE_AMBIENT = 0.16

/** Pointer distance, in CSS pixels, within which the ring counts as hovered. */
export const RING_HOVER_PX = 22

/**
 * Radius of the bright patch the beam leaves on the globe's surface. Kept well
 * inside the silhouette: it is where the light *lands*, and a patch that
 * covered the globe would be a wash rather than a landing point.
 */
export const LIGHT_SPOT_R = EARTH_RADIUS * 0.3

export interface RingTube {
  /** Centreline position per vertex — the tube's spine. */
  position: Float32Array
  /** Unit offset from the spine to the vertex, in the ring's own frame. */
  offset: Float32Array
  /** Arc angle of the vertex around the ring, 0..2π. */
  angle: Float32Array
  index: Uint16Array
}

/**
 * Builds the orbit ring as a tube whose radius is left to the vertex shader.
 *
 * Only the *spine* goes into `position`; the shader displaces each vertex along
 * `offset` by however thick the ring should be at that point, which is what
 * lets thickness respond to depth, to the lit band and to hover without the
 * geometry being rebuilt. The spine is also what three.js measures for
 * frustum culling, so the bounds stay right.
 *
 * The ring is built in local space and rotated by the mesh's own quaternion, so
 * the orbit costs one matrix rather than a CPU pass over every vertex.
 */
export function buildRingTube(
  radius: number,
  segments = RING_TUBE_SEGMENTS,
  sides = RING_TUBE_SIDES,
): RingTube {
  const cols = segments + 1 // last column duplicates the first — closes the seam
  const rows = sides + 1
  const count = cols * rows

  const position = new Float32Array(count * 3)
  const offset = new Float32Array(count * 3)
  const angle = new Float32Array(count)
  const index = new Uint16Array(segments * sides * 6)

  let v = 0
  for (let i = 0; i < cols; i++) {
    const a = (i / segments) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    for (let j = 0; j < rows; j++, v++) {
      const b = (j / sides) * Math.PI * 2
      const cb = Math.cos(b)
      const sb = Math.sin(b)
      position[v * 3] = radius * ca
      position[v * 3 + 1] = 0
      position[v * 3 + 2] = radius * sa
      // Cross-section frame: radial outward × the orbit plane's normal.
      offset[v * 3] = ca * cb
      offset[v * 3 + 1] = sb
      offset[v * 3 + 2] = sa * cb
      angle[v] = a
    }
  }

  let k = 0
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a0 = i * rows + j
      const b0 = (i + 1) * rows + j
      index[k++] = a0
      index[k++] = b0
      index[k++] = a0 + 1
      index[k++] = b0
      index[k++] = b0 + 1
      index[k++] = a0 + 1
    }
  }

  return { position, offset, angle, index }
}

/* ------------------------------------------------------------------ */
/* Ring hit-testing — shared by both renderers so hover agrees          */
/* ------------------------------------------------------------------ */

/** Shortest distance from `(px, py)` to the segment `a`→`b`, in pixels. */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t =
    len2 < 1e-9 ? 0 : THREE.MathUtils.clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1)
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

/**
 * How close the pointer is to a projected ring, in pixels.
 *
 * Measured against the *segments* rather than the sample points, so the answer
 * does not wobble with the ring's sampling — at 64 samples the gap between two
 * points is several pixels wide on the near side of the orbit, which is enough
 * for a pointer sitting right on the ring to read as a miss.
 */
export function nearestRingDistance(
  px: number,
  py: number,
  ringX: Float32Array,
  ringY: Float32Array,
  n: number,
) {
  let best = Infinity
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const d = distanceToSegment(px, py, ringX[i]!, ringY[i]!, ringX[j]!, ringY[j]!)
    if (d < best) best = d
  }
  return best
}

/**
 * Radius in pixels of a sphere's silhouette under perspective — the naive
 * `scale * R / d` is noticeably too small at this camera distance.
 */
export function silhouetteRadius(radius: number, scale: number) {
  return (scale * radius) / Math.sqrt(CAM_Z * CAM_Z - radius * radius)
}

/** The perspective scale factor for a viewport `height` CSS pixels tall. */
export function viewportScale(height: number) {
  return height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV_DEG) / 2)
}

/**
 * How much of the globe stands between the camera and `p`: `0` when the point
 * is clear of the silhouette, `1` when it sits dead behind the centre, with a
 * soft band across the rim so the emitter fades rather than steps.
 *
 * This is an exact occlusion test, not a `z < 0` guess: it asks whether the
 * segment from the eye to `p` passes through the sphere, which is the same
 * question the eye asks. `t` is where that segment comes closest to the globe's
 * centre — outside `(0, 1)` the sphere is behind the camera or beyond the
 * point, and in neither case can it hide anything.
 */
export function behindGlobeFactor(
  p: THREE.Vector3,
  camZ = CAM_Z,
  radius = EARTH_RADIUS,
) {
  const dx = p.x
  const dy = p.y
  const dz = p.z - camZ
  const len2 = dx * dx + dy * dy + dz * dz
  if (len2 < 1e-6) return 0

  const t = -(camZ * dz) / len2
  if (t <= 0 || t >= 1) return 0

  const perp = Math.hypot(dx * t, dy * t, camZ + dz * t)
  return 1 - THREE.MathUtils.smoothstep(perp, radius * 0.62, radius)
}

/* ------------------------------------------------------------------ */
/* Orbit-ring projection — shared by Canvas2D fallback and WebGL scene  */
/* ------------------------------------------------------------------ */

const _ringPt = new THREE.Vector3()

/**
 * Projects a 3D orbit ring (circle of radius `SPHERE_RADIUS` in the XZ plane)
 * through the current camera quaternion and perspective, returning per-segment
 * screen coordinates and occlusion factors.
 *
 * The ring is a true3D circle: viewed head-on it is a perfect circle; as the
 * quaternion tilts it deforms into a perspective-correct ellipse, exactly as
 * a real ring would under the same projection.
 *
 * All buffers are caller-owned and pre-allocated — no allocations happen per
 * call so this is safe inside a requestAnimationFrame loop.
 *
 * @param quat       Current orbit quaternion (rotates the ring).
 * @param n          Number of segments (RING_SEGMENTS).
 * @param radius     Ring radius in 3D space (SPHERE_RADIUS or OUTER_RING_SCALE * SPHERE_RADIUS).
 * @param scale      Perspective scale factor (h/2 / tan(FOV/2)).
 * @param cx         Viewport centre X in CSS pixels.
 * @param cy         Viewport centre Y in CSS pixels.
 * @param outX       Pre-allocated Float32Array(n) for screen X.
 * @param outY       Pre-allocated Float32Array(n) for screen Y.
 * @param outFade    Pre-allocated Float32Array(n) for per-point occlusion.
 * @param eyeX       Horizontal parallax lean of the eye, in world units.
 * @param eyeY       Vertical parallax lean of the eye, in world units.
 * @param outDepth   Optional Float32Array(n) for eye distance per point — what
 *                   the 2D renderer thickens the near side of the ring with.
 */
export function projectRing(
  quat: THREE.Quaternion,
  n: number,
  radius: number,
  scale: number,
  cx: number,
  cy: number,
  outX: Float32Array,
  outY: Float32Array,
  outFade: Float32Array,
  eyeX = 0,
  eyeY = 0,
  outDepth?: Float32Array,
) {
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const a = i * step
    _ringPt.set(
      radius * Math.cos(a),
      0,
      radius * Math.sin(a),
    )
    _ringPt.applyQuaternion(quat)
    outX[i] = projectX(_ringPt.x, _ringPt.z, scale, cx, eyeX)
    outY[i] = projectY(_ringPt.y, _ringPt.z, scale, cy, eyeY)
    outFade[i] = behindGlobeFactor(_ringPt)
    if (outDepth) {
      outDepth[i] = Math.hypot(_ringPt.x - eyeX, _ringPt.y - eyeY, CAM_Z - _ringPt.z)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Perspective projection with a leaning eye                            */
/* ------------------------------------------------------------------ */

/**
 * The eye leans a fraction of a degree off-axis as the light travels, which is
 * far too little to notice as camera movement and just enough that the near and
 * far sides of the orbit slide against each other — the cue that says the scene
 * has depth rather than being a drawing of one.
 *
 * The lean is modelled as a translation of the eye plus a re-centring term, so
 * the globe stays exactly where it is and only the parallax survives. Moving
 * the whole picture instead would produce no parallax at all.
 */
export function projectX(
  x: number,
  z: number,
  scale: number,
  cx: number,
  eyeX = 0,
) {
  const d = Math.max(CAM_Z - z, 0.05)
  return cx + scale * (eyeX / CAM_Z + (x - eyeX) / d)
}

export function projectY(
  y: number,
  z: number,
  scale: number,
  cy: number,
  eyeY = 0,
) {
  const d = Math.max(CAM_Z - z, 0.05)
  return cy - scale * (eyeY / CAM_Z + (y - eyeY) / d)
}
