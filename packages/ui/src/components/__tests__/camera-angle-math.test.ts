import { describe, expect, it } from "vitest"
import * as THREE from "three"
import {
  quatFromAngle,
  angleFromQuat,
  orbitRotate,
  damp,
  dampQuat,
  X_AXIS,
  Y_AXIS,
} from "../camera-angle-math"

describe("camera-angle-math", () => {
  describe("quatFromAngle / angleFromQuat roundtrip", () => {
    it("roundtrips front (0°, 0°)", () => {
      const q = quatFromAngle({ azimuth: 0, elevation: 0 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(0, 1)
      expect(a.elevation).toBeCloseTo(0, 1)
    })

    it("roundtrips right (90°, 0°)", () => {
      const q = quatFromAngle({ azimuth: 90, elevation: 0 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(90, 1)
      expect(a.elevation).toBeCloseTo(0, 1)
    })

    it("roundtrips top (0°, 90°)", () => {
      const q = quatFromAngle({ azimuth: 0, elevation: 90 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(0, 0)
      expect(a.elevation).toBeCloseTo(90, 1)
    })

    it("roundtrips back (180°, 0°)", () => {
      const q = quatFromAngle({ azimuth: 180, elevation: 0 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(180, 1)
      expect(a.elevation).toBeCloseTo(0, 1)
    })

    it("roundtrips left (270°, 0°)", () => {
      const q = quatFromAngle({ azimuth: 270, elevation: 0 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(270, 1)
      expect(a.elevation).toBeCloseTo(0, 1)
    })

    it("roundtrips bottom (0°, -90°)", () => {
      const q = quatFromAngle({ azimuth: 0, elevation: -90 })
      const a = angleFromQuat(q)
      expect(a.elevation).toBeCloseTo(-90, 1)
    })

    it("roundtrips diagonal (45°, 45°)", () => {
      const q = quatFromAngle({ azimuth: 45, elevation: 45 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(45, 1)
      expect(a.elevation).toBeCloseTo(45, 1)
    })

    it("roundtrips full circle (359°, 0°)", () => {
      const q = quatFromAngle({ azimuth: 359, elevation: 0 })
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(359, 1)
    })

    it("normalises azimuth into [0, 360)", () => {
      const q = quatFromAngle({ azimuth: 10, elevation: 0 })
      // Manually construct the "same" quaternion via axis rotation at -350°
      const q2 = quatFromAngle({ azimuth: 370, elevation: 0 })
      const a1 = angleFromQuat(q)
      const a2 = angleFromQuat(q2)
      expect(a1.azimuth).toBeCloseTo(a2.azimuth, 1)
    })
  })

  describe("orbitRotate", () => {
    it("rotates 360° around Y brings you back", () => {
      let q = quatFromAngle({ azimuth: 0, elevation: 0 })
      for (let i = 0; i < 4; i++) {
        q = orbitRotate(q, Y_AXIS, Math.PI / 2)
      }
      const a = angleFromQuat(q)
      // A full turn lands a hair either side of the wrap, so the check has to
      // be the distance round the circle — `% 360` on 359.999 is 359.999.
      const fromZero = Math.min(a.azimuth % 360, 360 - (a.azimuth % 360))
      expect(fromZero).toBeCloseTo(0, 1)
      expect(a.elevation).toBeCloseTo(0, 1)
    })

    it("rotates 90° right from front", () => {
      let q = quatFromAngle({ azimuth: 0, elevation: 0 })
      q = orbitRotate(q, Y_AXIS, Math.PI / 2)
      const a = angleFromQuat(q)
      expect(a.azimuth).toBeCloseTo(90, 1)
    })

    it("rotates 90° up from front (negative X rotation)", () => {
      let q = quatFromAngle({ azimuth: 0, elevation: 0 })
      // Negative X rotation lifts the light upward
      q = orbitRotate(q, X_AXIS, -Math.PI / 2)
      const a = angleFromQuat(q)
      expect(a.elevation).toBeCloseTo(90, 1)
    })

    it("rotates 90° down from front (positive X rotation)", () => {
      let q = quatFromAngle({ azimuth: 0, elevation: 0 })
      q = orbitRotate(q, X_AXIS, Math.PI / 2)
      const a = angleFromQuat(q)
      expect(a.elevation).toBeCloseTo(-90, 1)
    })
  })

  describe("damp", () => {
    it("converges toward target", () => {
      let v = 0
      for (let i = 0; i < 60; i++) {
        v = damp(v, 100, 0.001, 1 / 60)
      }
      expect(v).toBeGreaterThan(90)
    })

    it("converges toward zero", () => {
      let v = 100
      for (let i = 0; i < 120; i++) {
        v = damp(v, 0, 0.001, 1 / 60)
      }
      expect(v).toBeLessThan(1)
    })

    it("returns current immediately when delta is 0", () => {
      expect(damp(5, 10, 0.001, 0)).toBeCloseTo(5, 10)
    })
  })

  describe("dampQuat", () => {
    it("converges toward target", () => {
      const current = new THREE.Quaternion()
      const target = quatFromAngle({ azimuth: 90, elevation: 0 })
      for (let i = 0; i < 120; i++) {
        dampQuat(current, target, 0.001, 1 / 60)
      }
      const a = angleFromQuat(current)
      expect(a.azimuth).toBeCloseTo(90, 0)
    })
  })
})
