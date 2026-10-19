import * as THREE from 'three'
import { damp } from './camera-angle-math'
import { TRAIL_POINTS } from './camera-angle-geometry'

/**
 * Everything the controller does *over time* rather than in space.
 *
 * Breathing, the flash at the start of a drag, the pulse that leaves the
 * emitter as it travels, the bounce when it settles, hover, and how far the
 * trail stretches — all of it is derived here from three inputs (is the pointer
 * down, is the ring hovered, where is the light) and nothing else.
 *
 * It lives apart from both renderers on purpose. The WebGL scene and the 2D
 * fallback each own an instance and feed it the same inputs, so the two cannot
 * drift into disagreeing about how long a pulse lasts — and none of it touches
 * a rendering context, so the whole thing is unit-testable.
 */

/* ------------------------------------------------------------------ */
/* Timings                                                             */
/* ------------------------------------------------------------------ */

/** One full breath of the idle ring, in seconds. */
export const BREATH_PERIOD_S = 4
/** The two ends of that breath, as ring opacity. */
export const BREATH_MIN = 0.35
export const BREATH_MAX = 0.45
/** How long the whole-ring flash at the start of a drag takes to fade. */
export const FLASH_S = 0.26
/** How long a pulse ring takes to expand and vanish. */
export const PULSE_S = 0.3
/** How long the emitter's settle bounce takes. */
export const BOUNCE_S = 0.15
/** How big the emitter gets at the top of that bounce. */
export const BOUNCE_SCALE = 1.25
/**
 * Minimum gap between ripples shed by a moving emitter.
 *
 * Deliberately longer than `PULSE_S`. There is one ripple on screen at a time
 * — one mesh, one phase — so shedding faster than a ripple can finish does not
 * produce a train of them, it produces one ripple that keeps snapping back to
 * the start. Leaving it a beat of clear air is what makes them read as
 * separate.
 */
export const PULSE_INTERVAL_S = 0.34
/** Angular speed, rad/s, above which a travelling emitter sheds pulses. */
export const PULSE_SPEED = 0.4
/** Angular speed at which the smear behind the emitter is at full strength. */
export const TRAIL_SPEED_FULL = 2.4
/**
 * How often the emitter's position is recorded for the trail.
 *
 * A fixed interval rather than once per frame, so the smear covers the same
 * *time* on a 144 Hz monitor as on a 30 Hz one — sampling per frame makes a
 * fast display draw a short trail and a slow one draw a long one, which is
 * exactly backwards.
 */
export const TRAIL_SAMPLE_S = 1 / 60

const HOVER_SMOOTHING = 0.0005
const SPEED_SMOOTHING = 0.0006

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface CameraAngleMotion {
  /** Seconds since the state was created. Drives breathing and the beam. */
  time: number
  /** 1 at the instant a drag starts, decaying to 0. */
  flash: number
  /** 0→1 over one pulse; 1 means no pulse is running. */
  pulse: number
  /** 0→1 over one settle bounce; 1 means none is running. */
  bounce: number
  /** Damped hover strength, 0..1. */
  hover: number
  /** Damped angular speed of the emitter, rad/s. */
  speed: number
  /** Whether the pointer was down on the previous tick. */
  dragging: boolean
  /** Seconds since the last pulse was shed. */
  sincePulse: number
  /** Where the emitter was on the previous tick — the speed is derived from it. */
  prevDir: THREE.Vector3
  /** False until the first tick, when there is no previous direction to use. */
  started: boolean
}

export function createMotion(): CameraAngleMotion {
  return {
    time: 0,
    flash: 0,
    pulse: 1,
    bounce: 1,
    hover: 0,
    speed: 0,
    dragging: false,
    sincePulse: 0,
    prevDir: new THREE.Vector3(0, 0, 1),
    started: false,
  }
}

export interface MotionInput {
  dragging: boolean
  hovering: boolean
  /** Unit vector from the globe's centre toward the emitter. */
  lightDir: THREE.Vector3
}

/** Advances one frame. Mutates `m` — it is per-renderer state, never shared. */
export function advanceMotion(
  m: CameraAngleMotion,
  delta: number,
  input: MotionInput,
) {
  // A frame delta of zero would divide the speed by nothing; clamping the top
  // end keeps a tab that has been in the background from arriving as one
  // enormous step that fires every animation at once.
  const d = THREE.MathUtils.clamp(delta, 1e-4, 0.1)
  m.time += d

  // --- how fast the emitter is actually travelling -------------------
  let raw = 0
  if (m.started) {
    const dot = THREE.MathUtils.clamp(m.prevDir.dot(input.lightDir), -1, 1)
    raw = Math.acos(dot) / d
  }
  m.prevDir.copy(input.lightDir)
  m.started = true
  m.speed = damp(m.speed, raw, SPEED_SMOOTHING, d)

  m.hover = damp(m.hover, input.hovering ? 1 : 0, HOVER_SMOOTHING, d)

  // --- the two edges of a drag ---------------------------------------
  if (input.dragging && !m.dragging) {
    // Grabbing it lights the whole ring for an instant: the answer to "is this
    // thing draggable" arrives on the first frame rather than after the first
    // few pixels of travel.
    m.flash = 1
    m.pulse = 1
  }
  if (!input.dragging && m.dragging) {
    m.bounce = 0
    m.pulse = 0
    m.sincePulse = 0
  }
  m.dragging = input.dragging

  m.flash = Math.max(0, m.flash - d / FLASH_S)
  if (m.pulse < 1) m.pulse = Math.min(1, m.pulse + d / PULSE_S)
  if (m.bounce < 1) m.bounce = Math.min(1, m.bounce + d / BOUNCE_S)

  // --- pulses shed by a travelling emitter ---------------------------
  m.sincePulse += d
  if (m.speed > PULSE_SPEED && m.sincePulse >= PULSE_INTERVAL_S) {
    m.pulse = 0
    m.sincePulse = 0
  }
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

/** The idle ring's opacity right now: a slow breath between the two ends. */
export function breathAlpha(m: CameraAngleMotion) {
  const t = 0.5 * (1 + Math.sin((m.time / BREATH_PERIOD_S) * Math.PI * 2))
  return BREATH_MIN + (BREATH_MAX - BREATH_MIN) * t
}

/** That breath as a multiplier around its own midpoint, for tinted renderers. */
export function breathScale(m: CameraAngleMotion) {
  return breathAlpha(m) / ((BREATH_MIN + BREATH_MAX) / 2)
}

/** The emitter's scale — 1 except during the settle bounce. */
export function bounceScale(m: CameraAngleMotion) {
  if (m.bounce >= 1) return 1
  return 1 + (BOUNCE_SCALE - 1) * Math.sin(m.bounce * Math.PI)
}

export interface PulseState {
  /** Radius multiplier relative to the emitter's marker. */
  scale: number
  alpha: number
}

/** The expanding ring left behind by the emitter, or null when none is running. */
export function pulseState(m: CameraAngleMotion): PulseState | null {
  if (m.pulse >= 1) return null
  // Fast out of the gate and slowing as it fades, which is what makes it read
  // as a ripple rather than as a circle being scaled.
  const eased = 1 - (1 - m.pulse) * (1 - m.pulse)
  return { scale: 1 + 1.9 * eased, alpha: 0.5 * (1 - eased) ** 1.3 }
}

/**
 * How strongly the smear behind the emitter shows, 0..1.
 *
 * Driven by speed rather than by the drag flag, so a flick that is still
 * coasting on its own inertia keeps the smear it earned instead of dropping it
 * the moment the pointer comes up.
 */
export function trailStrength(m: CameraAngleMotion) {
  return THREE.MathUtils.clamp(m.speed / TRAIL_SPEED_FULL, 0, 1)
}

/* ------------------------------------------------------------------ */
/* Trail — where the emitter has actually been                         */
/* ------------------------------------------------------------------ */

/**
 * A fixed-length history of emitter positions, oldest first.
 *
 * The trail used to be an arc of the current orbit ring, which is only the path
 * the emitter took when the drag happened to be purely horizontal — tilt the
 * orbit and the smear peeled away from the light. Recording where the emitter
 * *was* is right for any axis, and it is also what makes the smear stretch on
 * its own when the drag is fast: more ground covered between two samples.
 */
export class TrailBuffer {
  /** `count * 3` floats, oldest sample first. */
  readonly points = new Float32Array(TRAIL_POINTS * 3)
  /** How many samples are valid. */
  count = 0
  private since = 0

  /** Feeds one frame in. Records a sample only on the fixed interval. */
  advance(delta: number, p: THREE.Vector3) {
    this.since += delta
    if (this.since < TRAIL_SAMPLE_S && this.count > 0) return
    this.since = 0

    if (this.count < TRAIL_POINTS) {
      const i = this.count++
      this.points[i * 3] = p.x
      this.points[i * 3 + 1] = p.y
      this.points[i * 3 + 2] = p.z
      return
    }
    // Full: drop the oldest. TRAIL_POINTS is small enough that shifting beats
    // the bookkeeping a ring buffer would need on every read.
    this.points.copyWithin(0, 3)
    const i = TRAIL_POINTS - 1
    this.points[i * 3] = p.x
    this.points[i * 3 + 1] = p.y
    this.points[i * 3 + 2] = p.z
  }

  reset() {
    this.count = 0
    this.since = 0
  }
}
