import { describe, expect, it } from "vitest"
import * as THREE from "three"
import {
  BOUNCE_S,
  BOUNCE_SCALE,
  BREATH_MAX,
  BREATH_MIN,
  BREATH_PERIOD_S,
  FLASH_S,
  PULSE_INTERVAL_S,
  PULSE_S,
  TRAIL_SAMPLE_S,
  TRAIL_SPEED_FULL,
  TrailBuffer,
  advanceMotion,
  bounceScale,
  breathAlpha,
  createMotion,
  pulseState,
  trailStrength,
  type CameraAngleMotion,
} from "../camera-angle-motion"
import { TRAIL_POINTS } from "../camera-angle-geometry"

/**
 * The motion engine is the one part of the controller both renderers share, so
 * what is pinned here is the *timing contract* between them: how long a flash
 * lasts, when a ripple is shed, how big the settle bounce gets. If the WebGL
 * scene and the 2D fallback ever disagree about any of it, they disagree
 * because this file changed — not because one of them drifted.
 */

const FRAME = 1 / 60
const STILL = new THREE.Vector3(0, 0, 1)

/** Runs `seconds` worth of frames with the emitter held still. */
function idle(m: CameraAngleMotion, seconds: number, dragging = false) {
  const frames = Math.round(seconds / FRAME)
  for (let i = 0; i < frames; i++) {
    advanceMotion(m, FRAME, { dragging, hovering: false, lightDir: STILL })
  }
}

/** Runs one frame with the emitter swept `radians` about the Y axis. */
function sweep(m: CameraAngleMotion, radians: number, dragging = true) {
  const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    radians,
  )
  advanceMotion(m, FRAME, { dragging, hovering: false, lightDir: dir })
}

describe("camera-angle-motion", () => {
  describe("flash", () => {
    it("fires on the frame a drag starts, and only then", () => {
      const m = createMotion()
      idle(m, 0.5)
      expect(m.flash).toBe(0)

      advanceMotion(m, FRAME, { dragging: true, hovering: false, lightDir: STILL })
      // One frame of decay has already been taken off the top.
      expect(m.flash).toBeGreaterThan(0.9)

      // Holding the drag does not re-fire it.
      idle(m, FLASH_S * 2, true)
      expect(m.flash).toBe(0)
    })

    it("is gone within its own duration", () => {
      const m = createMotion()
      advanceMotion(m, FRAME, { dragging: true, hovering: false, lightDir: STILL })
      idle(m, FLASH_S, true)
      expect(m.flash).toBe(0)
    })
  })

  describe("bounce", () => {
    it("runs once when the drag ends and peaks in the middle", () => {
      const m = createMotion()
      advanceMotion(m, FRAME, { dragging: true, hovering: false, lightDir: STILL })
      expect(bounceScale(m)).toBe(1)

      advanceMotion(m, FRAME, { dragging: false, hovering: false, lightDir: STILL })
      idle(m, BOUNCE_S / 2 - FRAME)
      expect(bounceScale(m)).toBeGreaterThan(1.2)
      expect(bounceScale(m)).toBeLessThanOrEqual(BOUNCE_SCALE)

      idle(m, BOUNCE_S)
      expect(bounceScale(m)).toBe(1)
    })
  })

  describe("pulse", () => {
    it("stays idle while the emitter is still", () => {
      const m = createMotion()
      idle(m, 2)
      expect(pulseState(m)).toBeNull()
    })

    it("leaves each ripple room to finish before shedding the next", () => {
      // With one ripple on screen at a time, an interval shorter than the
      // ripple's own life would restart it mid-flight forever and no ripple
      // would ever be seen to complete.
      expect(PULSE_INTERVAL_S).toBeGreaterThanOrEqual(PULSE_S)
    })

    it("is shed repeatedly while the emitter travels", () => {
      const m = createMotion()
      // A steady sweep well above the shed threshold: 3 rad/s.
      const step = 0.05
      let angle = 0
      let shed = 0
      let wasIdle = true
      for (let i = 0; i < Math.round(2 / FRAME); i++) {
        angle += step
        sweep(m, angle)
        const running = pulseState(m) !== null
        if (running && wasIdle) shed++
        wasIdle = !running
      }
      // Two seconds at the shed interval, less the frames the speed spent
      // ramping up through its own damping.
      expect(shed).toBeGreaterThanOrEqual(3)
      expect(shed).toBeLessThanOrEqual(Math.ceil(2 / PULSE_INTERVAL_S))
    })

    it("expands as it fades, and is gone within its duration", () => {
      const m = createMotion()
      advanceMotion(m, FRAME, { dragging: true, hovering: false, lightDir: STILL })
      advanceMotion(m, FRAME, { dragging: false, hovering: false, lightDir: STILL })

      const early = pulseState(m)!
      expect(early).not.toBeNull()
      idle(m, PULSE_S / 2)
      const late = pulseState(m)!
      expect(late.scale).toBeGreaterThan(early.scale)
      expect(late.alpha).toBeLessThan(early.alpha)

      idle(m, PULSE_S)
      expect(pulseState(m)).toBeNull()
    })
  })

  describe("breath", () => {
    it("swings between its two ends and comes back", () => {
      const m = createMotion()
      const seen: number[] = []
      for (let i = 0; i < Math.round(BREATH_PERIOD_S / FRAME); i++) {
        idle(m, FRAME)
        seen.push(breathAlpha(m))
      }
      expect(Math.min(...seen)).toBeCloseTo(BREATH_MIN, 2)
      expect(Math.max(...seen)).toBeCloseTo(BREATH_MAX, 2)
      // A full period later it is back where it started.
      expect(seen.at(-1)).toBeCloseTo(seen[0]!, 2)
    })
  })

  describe("hover", () => {
    it("eases in and out rather than snapping", () => {
      const m = createMotion()
      advanceMotion(m, FRAME, { dragging: false, hovering: true, lightDir: STILL })
      expect(m.hover).toBeGreaterThan(0)
      expect(m.hover).toBeLessThan(1)

      for (let i = 0; i < 60; i++) {
        advanceMotion(m, FRAME, { dragging: false, hovering: true, lightDir: STILL })
      }
      expect(m.hover).toBeGreaterThan(0.95)

      idle(m, 1)
      expect(m.hover).toBeLessThan(0.05)
    })
  })

  describe("speed and trail strength", () => {
    it("reads zero when the emitter is parked", () => {
      const m = createMotion()
      idle(m, 1)
      expect(m.speed).toBeCloseTo(0, 3)
      expect(trailStrength(m)).toBeCloseTo(0, 3)
    })

    it("saturates at the full-smear speed and never exceeds 1", () => {
      const m = createMotion()
      let angle = 0
      const step = TRAIL_SPEED_FULL * 2 * FRAME
      for (let i = 0; i < 120; i++) {
        angle += step
        sweep(m, angle)
      }
      expect(m.speed).toBeGreaterThan(TRAIL_SPEED_FULL)
      expect(trailStrength(m)).toBe(1)
    })

    it("survives a frame delta of zero without dividing by it", () => {
      const m = createMotion()
      advanceMotion(m, 0, { dragging: false, hovering: false, lightDir: STILL })
      expect(Number.isFinite(m.speed)).toBe(true)
      expect(Number.isFinite(m.time)).toBe(true)
    })

    it("clamps a background tab's giant catch-up frame", () => {
      const m = createMotion()
      const before = m.time
      advanceMotion(m, 30, { dragging: false, hovering: false, lightDir: STILL })
      // Thirty seconds of wall clock must not become thirty seconds of
      // animation, or every timed thing fires at once on the way back.
      expect(m.time - before).toBeLessThanOrEqual(0.1)
    })
  })

  describe("TrailBuffer", () => {
    it("records on a fixed interval, not once per frame", () => {
      const fast = new TrailBuffer()
      const slow = new TrailBuffer()
      const p = new THREE.Vector3(1, 0, 0)

      // Half a second at 240 Hz and at 60 Hz.
      for (let i = 0; i < 120; i++) fast.advance(1 / 240, p)
      for (let i = 0; i < 30; i++) slow.advance(1 / 60, p)

      expect(fast.count).toBe(slow.count)
    })

    it("keeps the newest samples, oldest first, and never grows", () => {
      const buf = new TrailBuffer()
      for (let i = 0; i < TRAIL_POINTS * 3; i++) {
        buf.advance(TRAIL_SAMPLE_S, new THREE.Vector3(i, 0, 0))
      }
      expect(buf.count).toBe(TRAIL_POINTS)
      expect(buf.points).toHaveLength(TRAIL_POINTS * 3)

      const first = buf.points[0]!
      const last = buf.points[(TRAIL_POINTS - 1) * 3]!
      expect(last).toBeGreaterThan(first)
      expect(last - first).toBe(TRAIL_POINTS - 1)
    })

    it("records the very first sample immediately", () => {
      const buf = new TrailBuffer()
      buf.advance(0, new THREE.Vector3(7, 8, 9))
      expect(buf.count).toBe(1)
      expect(Array.from(buf.points.slice(0, 3))).toEqual([7, 8, 9])
    })

    it("empties on reset", () => {
      const buf = new TrailBuffer()
      buf.advance(TRAIL_SAMPLE_S, new THREE.Vector3(1, 2, 3))
      buf.reset()
      expect(buf.count).toBe(0)
    })
  })
})
