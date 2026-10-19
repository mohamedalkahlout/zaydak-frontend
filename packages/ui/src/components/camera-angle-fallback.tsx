'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  CAM_Z,
  EARTH_RADIUS,
  GLOW_MARKER_R,
  LIGHT_SPOT_R,
  OUTER_RING_SCALE,
  PARALLAX_OFFSET,
  RING_BACK_FADE,
  RING_DASHES,
  RING_NEAR_MAX,
  RING_NEAR_MIN,
  RING_SEGMENTS,
  SPHERE_RADIUS,
  TRAIL_POINTS,
  WIRE_AMBIENT,
  behindGlobeFactor,
  projectRing,
  projectX,
  projectY,
  silhouetteRadius,
  viewportScale,
} from './camera-angle-geometry'
import { damp } from './camera-angle-math'
import {
  TrailBuffer,
  advanceMotion,
  bounceScale,
  breathScale,
  createMotion,
  pulseState,
  trailStrength,
} from './camera-angle-motion'

/**
 * The same scene as the WebGL one, drawn with the 2D canvas context.
 *
 * A machine with hardware acceleration turned off — or a GPU process that has
 * fallen over, which Chrome reports as `GL_VENDOR = Disabled` — can never
 * create a WebGL context, so the 3D widget is not "temporarily" unavailable
 * there, it is permanently unavailable. Rather than degrade to a sentence of
 * grey text, the control keeps its picture: wireframe globe, orbit ring, light
 * cube and beam, projected and shaded by hand. The 2D context is always
 * available, needs no GPU, and holds none of the contexts the WebGL path has to
 * ration.
 *
 * It is driven by the *same* refs as `<Scene />` and the same motion engine, so
 * dragging, hover, the flash, the ripple and the settle bounce all behave
 * identically and nothing above this component needs to know which renderer is
 * on screen. The two differ only in what the medium can do: the ring is a
 * stroked polyline that changes width rather than a tube, and the beam's flow
 * is a moving gradient stop rather than a shader.
 *
 * The 2D context has no depth buffer, so the layering is a painter's order:
 * far emitter, far hemisphere, glass, near hemisphere, near emitter.
 */

const BEAM_LENGTH = SPHERE_RADIUS * 0.62
const CUBE_HALF = 0.095

const GLOW: RGB = [63, 185, 80] // #3fb950
const WIRE_DARK: RGB = [48, 54, 61] // #30363d
const GLASS: RGB = [139, 152, 165] // #8b98a5
const RING_DIM: RGB = [110, 119, 129] // #6e7781
/** The emitter is a black body — only its edges and lens carry any light. */
const CUBE_BODY: RGB = [0, 0, 0]

/** Segments are bucketed by brightness so a frame is 8 strokes, not ~900. */
const SHADE_BUCKETS = 8
/** The quiet stretch of the orbit ring is bucketed the same way. */
const RING_BUCKETS = 6
/** What the far hemisphere's wire keeps of its brightness, seen through glass. */
const FAR_WIRE_ALPHA = 0.34
/**
 * How much the globe eats of the emitter that has passed behind it. The body
 * gives up most of its contrast — that is the depth cue — but the lens gives up
 * far less, because it is the handle the vendor is actually aiming and it has
 * to stay findable at every angle.
 */
const BEHIND_BODY_FADE = 0.72
const BEHIND_LENS_FADE = 0.4

/** The crosshair's spokes, in world units from the globe's centre. */
const CROSS_INNER = EARTH_RADIUS * 1.5
const CROSS_OUTER = SPHERE_RADIUS * OUTER_RING_SCALE * 1.04

type RGB = readonly [number, number, number]

/* ------------------------------------------------------------------ */
/* Geometry — built once at module level, reused every frame           */
/* ------------------------------------------------------------------ */

/** Latitude rings + meridians on the unit sphere, as polylines. */
function buildWireframe(rings: number, meridians: number, samples: number) {
  const lines: THREE.Vector3[][] = []

  for (let i = 1; i < rings; i++) {
    const phi = (i / rings) * Math.PI
    const line: THREE.Vector3[] = []
    for (let j = 0; j <= samples; j++) {
      const theta = (j / samples) * Math.PI * 2
      line.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        ),
      )
    }
    lines.push(line)
  }

  for (let j = 0; j < meridians; j++) {
    const theta = (j / meridians) * Math.PI * 2
    const line: THREE.Vector3[] = []
    for (let i = 0; i <= samples; i++) {
      const phi = (i / samples) * Math.PI
      line.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        ),
      )
    }
    lines.push(line)
  }

  return lines
}

const EARTH_WIRE = buildWireframe(9, 18, 36)
const GUIDE_WIRE = buildWireframe(7, 14, 28)

// Corner signs indexed (x, y, z); the faces below refer back into this list.
const CUBE_CORNERS: readonly (readonly [number, number, number])[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
]

const CUBE_FACES: readonly {
  idx: readonly number[]
  n: readonly [number, number, number]
}[] = [
  { idx: [0, 1, 2, 3], n: [0, 0, -1] },
  { idx: [4, 5, 6, 7], n: [0, 0, 1] },
  { idx: [0, 1, 5, 4], n: [0, -1, 0] },
  { idx: [3, 2, 6, 7], n: [0, 1, 0] },
  { idx: [1, 2, 6, 5], n: [1, 0, 0] },
  { idx: [0, 3, 7, 4], n: [-1, 0, 0] },
]

/** The four screen-space spokes of the drag crosshair, as unit directions. */
const CROSS_DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function mix(a: RGB, b: RGB, t: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ] as const
}

function rgba(c: readonly [number, number, number], alpha: number) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`
}

export interface CameraAngleFallbackProps {
  targetQuat: React.RefObject<THREE.Quaternion>
  draggingRef: React.RefObject<boolean>
  spinRef: React.RefObject<number>
  /** Coasting velocity left over from a flick. Optional — 0 means no inertia. */
  inertiaVelocityRef?: React.RefObject<number>
  /** 1 while the pointer is on the orbit ring. Optional — 0 means never. */
  hoverRef?: React.RefObject<number>
}

const ZERO = { current: 0 }

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CameraAngleFallback({
  targetQuat,
  draggingRef,
  spinRef,
  inertiaVelocityRef = ZERO,
  hoverRef = ZERO,
}: CameraAngleFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // jsdom has no 2D context; there is simply nothing to animate there.
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      ctx = null
    }
    if (!ctx) return
    const c = ctx

    /* ---- animation state ---- */
    const current = new THREE.Quaternion().copy(targetQuat.current)
    const motion = createMotion()
    const trail = new TrailBuffer()
    let currentSpin = 0
    let guideAlpha = 0.01
    let crossAlpha = 0
    let eyeX = 0
    let eyeY = 0
    let last = 0
    let raf = 0

    /* ---- scratch vectors, allocated once ---- */
    const spinQuat = new THREE.Quaternion()
    const inertiaQuat = new THREE.Quaternion()
    const yAxis = new THREE.Vector3(0, 1, 0)
    const inertiaAxis = new THREE.Vector3()
    const lightPos = new THREE.Vector3()
    const lightDir = new THREE.Vector3()
    const spotPos = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const point = new THREE.Vector3()
    const view = new THREE.Vector3()
    const toLight = new THREE.Vector3()
    const camPos = new THREE.Vector3(0, 0, CAM_Z)
    const fwd = new THREE.Vector3()
    const right = new THREE.Vector3()
    const up = new THREE.Vector3()
    const tmp = new THREE.Vector3()
    const faceNormal = new THREE.Vector3()
    const faceCenter = new THREE.Vector3()
    const corners = CUBE_CORNERS.map(() => new THREE.Vector3())
    const cornerPx = CUBE_CORNERS.map(() => ({ x: 0, y: 0 }))

    /* ---- ring-projection scratch buffers (reused every frame) ---- */
    const N = RING_SEGMENTS
    const ringX = new Float32Array(N)
    const ringY = new Float32Array(N)
    const ringFade = new Float32Array(N)
    const ringDepth = new Float32Array(N)
    const outerRingX = new Float32Array(N)
    const outerRingY = new Float32Array(N)
    const outerRingFade = new Float32Array(N)
    const outerRingDepth = new Float32Array(N)
    const trailPx = new Float32Array(TRAIL_POINTS * 2)

    /** The dash pattern, precomputed once per segment. */
    const segDash = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      segDash[i] = THREE.MathUtils.smoothstep(
        0.5 + 0.5 * Math.sin(a * RING_DASHES),
        0.18,
        0.8,
      )
    }

    /* ---- viewport ---- */
    let w = 0
    let h = 0
    let dpr = 1
    let scale = 0
    let cx = 0
    let cy = 0

    // Measuring is a forced layout, so it happens on resize rather than on
    // every frame. The first pass is dirty by definition; a zero-sized read
    // (not laid out yet) stays dirty so it is taken again next frame.
    let dirty = true
    const measure = () => {
      if (!dirty) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        w = 0
        h = 0
        return
      }
      dirty = false
      w = rect.width
      h = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      scale = viewportScale(h)
      cx = w / 2
      cy = h / 2
    }

    const invalidate = () => {
      dirty = true
    }
    const ro =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate)
    ro?.observe(canvas)
    // Covers the case a ResizeObserver cannot see: the same CSS size arriving
    // on a screen with a different device pixel ratio.
    window.addEventListener('resize', invalidate)

    let px = 0
    let py = 0
    let pd = 1
    /** Perspective-projects `v` into `px`/`py`, leaving its depth in `pd`. */
    const project = (v: THREE.Vector3) => {
      pd = Math.max(CAM_Z - v.z, 0.05)
      px = projectX(v.x, v.z, scale, cx, eyeX)
      py = projectY(v.y, v.z, scale, cy, eyeY)
    }

    /* ---- the globe's wire, bucketed by brightness and by hemisphere ---- */
    const nearBuckets: Path2D[] = []
    const farBuckets: Path2D[] = []

    /**
     * One projection pass over the whole sphere, sorted into two sets of
     * brightness buckets: the hemisphere facing us and the one facing away.
     * Both are shaded — the far side is the *lit* side whenever the emitter has
     * swung round the back, and hiding it would throw away the one cue that
     * says where the light went.
     */
    const buildLitWire = (
      lines: THREE.Vector3[][],
      radius: number,
      rot: THREE.Quaternion | null,
    ) => {
      nearBuckets.length = 0
      farBuckets.length = 0
      for (let i = 0; i < SHADE_BUCKETS; i++) {
        nearBuckets.push(new Path2D())
        farBuckets.push(new Path2D())
      }

      for (const line of lines) {
        let hasPrev = false
        let prevX = 0
        let prevY = 0
        let prevNear = false
        let prevLight = 0

        for (const unit of line) {
          normal.copy(unit)
          if (rot) normal.applyQuaternion(rot)
          point.copy(normal).multiplyScalar(radius)

          // Facing is measured against the eye ray, not the z sign — at this
          // distance the silhouette sits a good way behind the equator.
          view.copy(camPos).sub(point).normalize()
          const near = normal.dot(view) > 0.015

          toLight.copy(lightPos).sub(point).normalize()
          const light = Math.max(0, normal.dot(toLight))

          project(point)

          // A segment straddling the silhouette belongs to neither set; at 36
          // samples a ring it is a sliver, and dropping it costs nothing.
          if (hasPrev && prevNear === near) {
            const t = Math.pow((prevLight + light) / 2, 0.75)
            const bucket = Math.min(
              SHADE_BUCKETS - 1,
              Math.round(t * (SHADE_BUCKETS - 1)),
            )
            const path = (near ? nearBuckets : farBuckets)[bucket]!
            path.moveTo(prevX, prevY)
            path.lineTo(px, py)
          }

          hasPrev = true
          prevX = px
          prevY = py
          prevNear = near
          prevLight = light
        }
      }
    }

    /**
     * The wire's brightness ramp. The floor is `WIRE_AMBIENT`, deliberately
     * low: the hemisphere the light cannot reach has to read as being in
     * shadow, so the terminator is an edge sweeping across the globe rather
     * than a gentle change of tint. The 3D renderer's wire shader uses the same
     * constant, from the same file.
     */
    const strokeBuckets = (buckets: Path2D[], alphaScale: number) => {
      for (let k = 0; k < SHADE_BUCKETS; k++) {
        const t = k / (SHADE_BUCKETS - 1)
        c.strokeStyle = rgba(
          mix(WIRE_DARK, GLOW, t),
          (WIRE_AMBIENT + (1 - WIRE_AMBIENT) * t) * alphaScale,
        )
        c.lineWidth = 1 + t * 0.4
        c.stroke(buckets[k]!)
      }
    }

    /** The guide sphere: unlit, one flat path, both hemispheres at once. */
    const drawFlatWire = (
      lines: THREE.Vector3[][],
      radius: number,
      alpha: number,
    ) => {
      const path = new Path2D()
      for (const line of lines) {
        let hasPrev = false
        for (const unit of line) {
          point.copy(unit).multiplyScalar(radius)
          project(point)
          if (hasPrev) path.lineTo(px, py)
          else path.moveTo(px, py)
          hasPrev = true
        }
      }
      c.strokeStyle = rgba(RING_DIM, alpha)
      c.lineWidth = 1
      c.stroke(path)
    }

    /**
     * The glass itself. The interior is never painted opaque — the panel still
     * shows through, and so does everything behind the globe — but a fresnel
     * gradient that is nothing at the centre and a thin bright rim at the edge
     * is what stops a see-through globe reading as a loose ball of wire.
     *
     * The light's sheen rides in the *same* gradient rather than as a second
     * fill on top: its inner circle is pulled toward wherever the beam lands,
     * so the glass picks up a patch of the emitter's colour on the side facing
     * it. One fill, so the globe is still exactly one thing painted at globe
     * size — and nothing here is ever clipped, so there is no hidden state.
     */
    const drawGlass = (spotX: number, spotY: number, lit: number) => {
      const r = silhouetteRadius(EARTH_RADIUS, scale)
      const ix = cx + (spotX - cx) * 0.55
      const iy = cy + (spotY - cy) * 0.55
      const grad = c.createRadialGradient(ix, iy, 0, cx, cy, r)
      grad.addColorStop(0, rgba(GLOW, 0.06 * lit))
      grad.addColorStop(0.72, rgba(GLASS, 0.02))
      grad.addColorStop(1, rgba(GLASS, 0.1))

      c.fillStyle = grad
      c.beginPath()
      c.arc(cx, cy, r, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = rgba(GLASS, 0.18)
      c.lineWidth = 1
      c.stroke()
    }

    /* ---- the light's orbit, as 3D-projected rings ---- */

    /**
     * One ring: dashed and grey all the way round, and thicker on the side
     * nearest the eye — the cue that turns a drawn ellipse into a circle seen
     * from an angle. Segments are bucketed by brightness, so the whole ring
     * costs a handful of strokes rather than one per segment.
     */
    const drawOneRing = (
      rx: Float32Array,
      ry: Float32Array,
      fd: Float32Array,
      depth: Float32Array,
      baseAlpha: number,
      widthScale: number,
      breath: number,
      hover: number,
      flash: number,
    ) => {
      const quiet: Path2D[] = []
      const quietUsed: boolean[] = []
      for (let k = 0; k < RING_BUCKETS; k++) {
        quiet.push(new Path2D())
        quietUsed.push(false)
      }

      c.save()
      c.lineCap = 'round'
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N
        const occ = (fd[i]! + fd[j]!) * 0.5
        const near =
          1 -
          THREE.MathUtils.smoothstep(
            (depth[i]! + depth[j]!) * 0.5,
            RING_NEAR_MIN,
            RING_NEAR_MAX,
          )

        let alpha = baseAlpha * breath * segDash[i]!
        alpha *= THREE.MathUtils.lerp(1, RING_BACK_FADE, occ)
        alpha *= 1 + 0.55 * hover + 0.9 * flash
        // Depth rides in the same number as brightness. The shader keeps them
        // apart — there, depth drives the tube's radius and nothing else — but
        // a 2D stroke has to pick one bucket, and a far segment being both
        // thinner and dimmer is the same statement made twice.
        alpha *= 0.58 + 0.62 * near
        if (alpha < 0.015) continue

        const k = Math.min(
          RING_BUCKETS - 1,
          Math.round((alpha / 0.7) * (RING_BUCKETS - 1)),
        )
        quiet[k]!.moveTo(rx[i]!, ry[i]!)
        quiet[k]!.lineTo(rx[j]!, ry[j]!)
        quietUsed[k] = true
      }

      for (let k = 0; k < RING_BUCKETS; k++) {
        if (!quietUsed[k]) continue
        const t = k / (RING_BUCKETS - 1)
        c.strokeStyle = rgba(RING_DIM, 0.7 * t)
        c.lineWidth = widthScale * (0.6 + 1.5 * t) * (1 + 0.35 * hover)
        c.stroke(quiet[k]!)
      }
      c.restore()
    }

    /**
     * A fading smear through the emitter's recent positions. It is where the
     * light has actually *been*, so it follows any drag axis rather than only a
     * horizontal one, and it stretches on its own when the drag is fast: more
     * ground covered between two samples.
     *
     * Drawn as four nested strokes over progressively shorter tails, which
     * under additive blending is a brightness ramp for four stroke calls
     * instead of one per segment.
     */
    const drawTrail = (strength: number, occluded: number) => {
      if (strength < 0.02 || trail.count < 2) return
      for (let i = 0; i < trail.count; i++) {
        tmp.set(
          trail.points[i * 3]!,
          trail.points[i * 3 + 1]!,
          trail.points[i * 3 + 2]!,
        )
        project(tmp)
        trailPx[i * 2] = px
        trailPx[i * 2 + 1] = py
      }

      c.save()
      c.globalCompositeOperation = 'lighter'
      c.lineCap = 'round'
      c.lineJoin = 'round'
      const alpha = 0.16 * strength * (1 - 0.6 * occluded)
      for (const [from, width] of [
        [0, 1.4],
        [Math.floor(trail.count * 0.4), 2.1],
        [Math.floor(trail.count * 0.7), 2.8],
        [Math.floor(trail.count * 0.88), 3.4],
      ] as const) {
        if (from >= trail.count - 1) continue
        c.beginPath()
        c.moveTo(trailPx[from * 2]!, trailPx[from * 2 + 1]!)
        for (let i = from + 1; i < trail.count; i++) {
          c.lineTo(trailPx[i * 2]!, trailPx[i * 2 + 1]!)
        }
        c.strokeStyle = rgba(GLOW, alpha)
        c.lineWidth = width
        c.stroke()
      }
      c.restore()
    }

    /**
     * A small glowing dot on the orbit at the light's current position, the
     * ripple it sheds as it travels, and the little swell it gives when it
     * settles. The marker fades with globe occlusion just like the emitter.
     */
    const drawGlowMarker = (emitterOccluded: number) => {
      project(lightPos)
      const r = Math.max(1.5, (GLOW_MARKER_R * scale) / pd) * bounceScale(motion)
      const alpha = 1 - 0.72 * emitterOccluded

      c.save()
      c.globalCompositeOperation = 'lighter'

      const ripple = pulseState(motion)
      if (ripple) {
        c.strokeStyle = rgba(GLOW, ripple.alpha * alpha)
        c.lineWidth = 1.6
        c.beginPath()
        c.arc(px, py, r * 1.9 * ripple.scale, 0, Math.PI * 2)
        c.stroke()
      }

      // Outer halo
      const halo = c.createRadialGradient(px, py, 0, px, py, r * 4)
      halo.addColorStop(0, rgba(GLOW, 0.4 * alpha))
      halo.addColorStop(1, rgba(GLOW, 0))
      c.fillStyle = halo
      c.beginPath()
      c.arc(px, py, r * 4, 0, Math.PI * 2)
      c.fill()
      // Bright core
      c.fillStyle = rgba(GLOW, 0.85 * alpha)
      c.beginPath()
      c.arc(px, py, r, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    /**
     * The bright patch on the globe where the beam lands. Without it the beam
     * is a cone pointing at a wireframe and stopping; with it the light has
     * somewhere to arrive.
     */
    const drawLightSpot = () => {
      spotPos.copy(lightDir).multiplyScalar(EARTH_RADIUS * 1.008)
      const hidden = behindGlobeFactor(spotPos)
      if (hidden > 0.98) return
      project(spotPos)
      const r = Math.max(2, (LIGHT_SPOT_R * scale) / pd)
      const grad = c.createRadialGradient(px, py, 0, px, py, r)
      grad.addColorStop(0, rgba(GLOW, 0.34 * (1 - hidden)))
      grad.addColorStop(1, rgba(GLOW, 0))
      c.save()
      c.globalCompositeOperation = 'lighter'
      c.fillStyle = grad
      c.beginPath()
      c.arc(px, py, r, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    /** Four arrowed spokes in the screen plane, only while steering. */
    const drawCrosshair = (alpha: number) => {
      if (alpha < 0.01) return
      const path = new Path2D()
      for (const [dx, dy] of CROSS_DIRS) {
        const ix = cx + dx * CROSS_INNER * (scale / CAM_Z)
        const iy = cy - dy * CROSS_INNER * (scale / CAM_Z)
        const ox = cx + dx * CROSS_OUTER * (scale / CAM_Z)
        const oy = cy - dy * CROSS_OUTER * (scale / CAM_Z)
        path.moveTo(ix, iy)
        path.lineTo(ox, oy)
        const bx = cx + dx * (CROSS_OUTER - 0.1) * (scale / CAM_Z)
        const by = cy - dy * (CROSS_OUTER - 0.1) * (scale / CAM_Z)
        const nx = -dy * 0.055 * (scale / CAM_Z)
        const ny = dx * 0.055 * (scale / CAM_Z)
        path.moveTo(ox, oy)
        path.lineTo(bx + nx, by - ny)
        path.moveTo(ox, oy)
        path.lineTo(bx - nx, by + ny)
      }
      c.strokeStyle = rgba(RING_DIM, alpha)
      c.lineWidth = 1
      c.stroke(path)
    }

    /* ---- cone of light from the cube toward the centre ---- */

    /**
     * The beam. Its brightest stop travels from the lens toward the globe
     * rather than sitting still, which is the difference between a cone that is
     * pointed at something and one that is emitting.
     */
    const drawBeam = (fade: number, time: number) => {
      // Apex just off the lens, base short of the globe.
      tmp.copy(fwd).multiplyScalar(0.1).add(lightPos)
      project(tmp)
      const ax = px
      const ay = py
      const ad = pd

      tmp.copy(fwd).multiplyScalar(0.1 + BEAM_LENGTH).add(lightPos)
      project(tmp)
      const bx = px
      const by = py
      const bd = pd

      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy)
      if (len < 0.5) return
      const nx = -dy / len
      const ny = dx / len

      // Where the travelling pulse is right now, as a fraction along the cone.
      const head = (time * 0.425) % 1

      c.save()
      c.globalCompositeOperation = 'lighter'
      for (const { r, alpha } of [
        { r: 0.5, alpha: 0.09 },
        { r: 0.32, alpha: 0.16 },
        { r: 0.16, alpha: 0.3 },
      ]) {
        const w1 = (0.05 * scale) / ad
        const w2 = (r * scale) / bd
        const grad = c.createLinearGradient(ax, ay, bx, by)
        grad.addColorStop(0, rgba(GLOW, alpha * fade))
        // The moving stop, kept inside (0, 1) so the ramp stays monotonic.
        const at = THREE.MathUtils.clamp(head, 0.02, 0.98)
        grad.addColorStop(at, rgba(GLOW, alpha * fade * (1.5 - 1.2 * at)))
        grad.addColorStop(1, rgba(GLOW, 0))
        c.fillStyle = grad
        c.beginPath()
        c.moveTo(ax + nx * w1, ay + ny * w1)
        c.lineTo(bx + nx * w2, by + ny * w2)
        c.lineTo(bx - nx * w2, by - ny * w2)
        c.lineTo(ax - nx * w1, ay - ny * w1)
        c.closePath()
        c.fill()
      }
      c.restore()
    }

    /* ---- the emitter cube and its lens ---- */
    const drawCube = (fade: number, lensAlpha: number) => {
      const bounce = bounceScale(motion)
      const half = CUBE_HALF * bounce
      for (let i = 0; i < CUBE_CORNERS.length; i++) {
        const [sx, sy, sz] = CUBE_CORNERS[i]!
        corners[i]!
          .copy(right)
          .multiplyScalar(sx * half)
          .addScaledVector(up, sy * half)
          .addScaledVector(fwd, sz * half)
          .add(lightPos)
        project(corners[i]!)
        cornerPx[i]!.x = px
        cornerPx[i]!.y = py
      }

      for (const face of CUBE_FACES) {
        faceNormal
          .copy(right)
          .multiplyScalar(face.n[0])
          .addScaledVector(up, face.n[1])
          .addScaledVector(fwd, face.n[2])
        faceCenter
          .copy(faceNormal)
          .multiplyScalar(half)
          .add(lightPos)
        view.copy(camPos).sub(faceCenter).normalize()
        if (faceNormal.dot(view) <= 0) continue

        c.beginPath()
        face.idx.forEach((i, k) => {
          const p = cornerPx[i]!
          if (k === 0) c.moveTo(p.x, p.y)
          else c.lineTo(p.x, p.y)
        })
        c.closePath()

        // Flat black body; the edge lines are what give it its form.
        c.fillStyle = rgba(CUBE_BODY, fade)
        c.fill()
        c.strokeStyle = rgba(RING_DIM, 0.85 * fade)
        c.lineWidth = 1
        c.stroke()
      }

      // Lens on the face aimed at the centre.
      tmp.copy(fwd).multiplyScalar(0.098 * bounce).add(lightPos)
      project(tmp)
      const lensR = Math.max(1, (0.055 * bounce * scale) / pd)

      c.save()
      c.globalCompositeOperation = 'lighter'
      const halo = c.createRadialGradient(px, py, 0, px, py, lensR * 3.2)
      halo.addColorStop(0, rgba(GLOW, 0.45 * lensAlpha))
      halo.addColorStop(1, rgba(GLOW, 0))
      c.fillStyle = halo
      c.beginPath()
      c.arc(px, py, lensR * 3.2, 0, Math.PI * 2)
      c.fill()
      c.restore()

      c.fillStyle = rgba(GLOW, lensAlpha)
      c.beginPath()
      c.arc(px, py, lensR, 0, Math.PI * 2)
      c.fill()
    }

    /* ---- frame ---- */
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const delta = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.05)
      last = now

      measure()
      if (w === 0 || h === 0) return

      // Inertia, integrated here for the same reason the 3D path integrates it
      // in one place: whatever coasts after a flick has to be one motion.
      const inertia = inertiaVelocityRef.current ?? 0
      if (!draggingRef.current && Math.abs(inertia) > 0.0005) {
        inertiaAxis.set(0, 1, 0).applyQuaternion(targetQuat.current).normalize()
        inertiaQuat.setFromAxisAngle(inertiaAxis, inertia * delta)
        targetQuat.current = inertiaQuat.multiply(targetQuat.current)
        inertiaVelocityRef.current = damp(inertia, 0, 0.00001, delta)
      }

      current.slerp(targetQuat.current, 1 - Math.pow(0.000001, delta))
      spinRef.current += delta * 0.05 + inertia * delta
      currentSpin = THREE.MathUtils.lerp(
        currentSpin,
        spinRef.current,
        1 - Math.pow(0.0001, delta),
      )

      lightPos.set(0, 0, SPHERE_RADIUS).applyQuaternion(current)
      lightDir.copy(lightPos).normalize()
      spinQuat.setFromAxisAngle(yAxis, currentSpin)

      advanceMotion(motion, delta, {
        dragging: draggingRef.current,
        hovering: (hoverRef.current ?? 0) > 0.5,
        lightDir,
      })
      trail.advance(delta, lightPos)

      guideAlpha = THREE.MathUtils.lerp(
        guideAlpha,
        draggingRef.current ? 0.14 : 0.01 + 0.06 * motion.hover,
        1 - Math.pow(0.002, delta),
      )
      crossAlpha = damp(crossAlpha, motion.dragging ? 0.3 : 0, 0.0015, delta)
      eyeX = damp(eyeX, lightDir.x * PARALLAX_OFFSET, 0.002, delta)
      eyeY = damp(eyeY, lightDir.y * PARALLAX_OFFSET, 0.002, delta)

      // Cube basis: +Z (`fwd`) aims at the centre, matching the 3D rig.
      fwd.copy(lightPos).negate().normalize()
      right.copy(yAxis).cross(fwd)
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
      right.normalize()
      up.copy(fwd).cross(right).normalize()

      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, w, h)

      // Painter's order. Behind the globe the emitter is dimmed and painted
      // under the glass rather than clipped away: a light on the far side is
      // exactly what "back" means, and a control that erases its own handle for
      // a third of its travel cannot be aimed.
      const occluded = behindGlobeFactor(lightPos)
      const breath = breathScale(motion)
      const drawEmitter = () => {
        drawBeam(1 - BEHIND_BODY_FADE * occluded, motion.time)
        drawCube(
          1 - BEHIND_BODY_FADE * occluded,
          1 - BEHIND_LENS_FADE * occluded,
        )
      }

      drawCrosshair(crossAlpha)
      if (guideAlpha > 0.02) {
        drawFlatWire(GUIDE_WIRE, SPHERE_RADIUS, guideAlpha)
      }

      buildLitWire(EARTH_WIRE, EARTH_RADIUS, spinQuat)

      projectRing(current, N, SPHERE_RADIUS, scale, cx, cy, ringX, ringY, ringFade, eyeX, eyeY, ringDepth)
      projectRing(current, N, SPHERE_RADIUS * OUTER_RING_SCALE, scale, cx, cy, outerRingX, outerRingY, outerRingFade, eyeX, eyeY, outerRingDepth)
      drawOneRing(ringX, ringY, ringFade, ringDepth, 0.5, 1, breath, motion.hover, motion.flash)
      drawOneRing(outerRingX, outerRingY, outerRingFade, outerRingDepth, 0.3, 0.85, breath, motion.hover, motion.flash)

      drawTrail(trailStrength(motion), occluded)

      if (occluded > 0) {
        drawLightSpot()
        drawGlowMarker(occluded)
        drawEmitter()
      }

      strokeBuckets(farBuckets, FAR_WIRE_ALPHA)
      // The sheen rides the glass gradient, so where the beam lands has to be
      // projected before the glass is painted rather than after it.
      spotPos.copy(lightDir).multiplyScalar(EARTH_RADIUS * 1.008)
      project(spotPos)
      drawGlass(px, py, 1 - occluded)
      strokeBuckets(nearBuckets, 1)

      if (occluded <= 0) {
        drawLightSpot()
        drawGlowMarker(occluded)
        drawEmitter()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', invalidate)
    }
  }, [targetQuat, draggingRef, spinRef, inertiaVelocityRef, hoverRef])

  return (
    <canvas
      ref={canvasRef}
      data-testid="camera-angle-fallback"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
