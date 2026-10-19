/**
 * Numbers, easing and a small rAF tween for the template's one-off animations.
 * Nothing here touches `window` at import time, so the module is safe to load
 * during server rendering.
 */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** 0 before `from`, 1 after `to`, linear in between. */
export const ramp = (from: number, to: number, v: number) => clamp((v - from) / (to - from))
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export type Easing = (t: number) => number

export const ease = {
  linear: ((t) => t) as Easing,
  expoOut: ((t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))) as Easing,
  expoInOut: ((t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2) as Easing,
  quadInOut: ((t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)) as Easing,
  cubicIn: ((t) => t * t * t) as Easing,
  cubicInOut: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)) as Easing,
  quartIn: ((t) => t * t * t * t) as Easing,
  /** Swings back a little before it goes; `s` sizes the swing. */
  backIn: (s = 1.70158): Easing => (t) => t * t * ((s + 1) * t - s),
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

export interface Tween {
  /** Jump to the end now (and run `done`). rAF sleeps in background tabs, so callers keep a timeout that calls this. */
  finish: () => void
  /** Stop where it is, without running `done`. */
  cancel: () => void
}

/** Drives `update` from 0 to 1 over `seconds`, eased. */
export function tween(seconds: number, easing: Easing, update: (k: number) => void, done?: () => void): Tween {
  let start: number | null = null
  let raf = 0
  let over = false
  const finish = () => {
    if (over) return
    over = true
    cancelAnimationFrame(raf)
    update(1)
    done?.()
  }
  if (seconds <= 0 || prefersReducedMotion()) {
    finish()
    return { finish, cancel() {} }
  }
  const step = (now: number) => {
    if (start === null) start = now
    const t = Math.min(1, (now - start) / (seconds * 1000))
    update(easing(t))
    if (t < 1) raf = requestAnimationFrame(step)
    else finish()
  }
  raf = requestAnimationFrame(step)
  return {
    finish,
    cancel() {
      over = true
      cancelAnimationFrame(raf)
    },
  }
}

/**
 * A smooth curve through `[x, y]` knots that never runs backwards: monotone cubic
 * Hermite with Fritsch-Carlson tangents. `pinned` fixes the slope at knot `i`.
 */
export function monotoneCurve(knots: [number, number][], pinned: Record<number, number> = {}) {
  const n = knots.length
  const width: number[] = []
  const slope: number[] = []
  const tangent: number[] = []
  for (let i = 0; i < n - 1; i++) {
    width[i] = knots[i + 1][0] - knots[i][0]
    slope[i] = (knots[i + 1][1] - knots[i][1]) / width[i]
  }
  for (let i = 0; i < n; i++) {
    if (pinned[i] !== undefined) tangent[i] = pinned[i]
    else if (i === 0) tangent[i] = slope[0]
    else if (i === n - 1) tangent[i] = slope[n - 2]
    else if (slope[i - 1] * slope[i] <= 0) tangent[i] = 0
    else {
      const a = 2 * width[i] + width[i - 1]
      const b = width[i] + 2 * width[i - 1]
      tangent[i] = (a + b) / (a / slope[i - 1] + b / slope[i])
    }
  }
  return (x: number) => {
    if (x <= knots[0][0]) return knots[0][1]
    if (x >= knots[n - 1][0]) return knots[n - 1][1]
    let i = 0
    while (x > knots[i + 1][0]) i++
    const h = width[i]
    const t = (x - knots[i][0]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * knots[i][1] +
      (t3 - 2 * t2 + t) * h * tangent[i] +
      (3 * t2 - 2 * t3) * knots[i + 1][1] +
      (t3 - t2) * h * tangent[i + 1]
    )
  }
}
