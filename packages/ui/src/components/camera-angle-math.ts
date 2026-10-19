import * as THREE from 'three'
import type { CameraAngle } from './camera-angle-controller'

/* ------------------------------------------------------------------ */
/* Quaternion helpers — free 360° trackball, no gimbal lock, no clamp  */
/* ------------------------------------------------------------------ */

export const Y_AXIS = new THREE.Vector3(0, 1, 0)
export const X_AXIS = new THREE.Vector3(1, 0, 0)

const _qy = new THREE.Quaternion()
const _qx = new THREE.Quaternion()

export function quatFromAngle(angle: CameraAngle) {
  _qy.setFromAxisAngle(Y_AXIS, THREE.MathUtils.degToRad(angle.azimuth))
  _qx.setFromAxisAngle(X_AXIS, THREE.MathUtils.degToRad(-angle.elevation))
  return new THREE.Quaternion().multiplyQuaternions(_qy, _qx)
}

const _dir = new THREE.Vector3(0, 0, 1)

export function angleFromQuat(q: THREE.Quaternion): CameraAngle {
  _dir.set(0, 0, 1).applyQuaternion(q)
  const azimuth =
    (THREE.MathUtils.radToDeg(Math.atan2(_dir.x, _dir.z)) + 360) % 360
  const elevation = THREE.MathUtils.radToDeg(
    Math.asin(THREE.MathUtils.clamp(_dir.y, -1, 1)),
  )
  return { azimuth, elevation }
}

/** Rotate q in view space around the given screen axis. */
export function orbitRotate(
  q: THREE.Quaternion,
  axis: THREE.Vector3,
  rad: number,
) {
  const r = new THREE.Quaternion().setFromAxisAngle(axis, rad)
  return r.multiply(q)
}

/* ------------------------------------------------------------------ */
/* Easing helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Exponential damping toward a target value.
 *
 * `smoothing` controls convergence speed: lower = faster.
 * At 60 fps with smoothing = 0.0001 this reaches 99% in ~0.5 s.
 */
export function damp(current: number, target: number, smoothing: number, delta: number) {
  return current + (target - current) * (1 - Math.pow(smoothing, delta))
}

/** Slerp a quaternion toward a target using frame-rate-independent damping. */
export function dampQuat(
  current: THREE.Quaternion,
  target: THREE.Quaternion,
  smoothing: number,
  delta: number,
) {
  const t = 1 - Math.pow(smoothing, delta)
  current.slerp(target, t)
}
