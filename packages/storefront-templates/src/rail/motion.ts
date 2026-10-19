/** Critically damped slide, the same settle the reference rail uses. */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  dtMs: number,
  omega = 18,
): { position: number; velocity: number } {
  const dt = Math.min(Math.max(dtMs, 0), 50) / 1000
  const error = position - target
  const kick = velocity + omega * error
  const decay = Math.exp(-omega * dt)
  const next = target + (error + kick * dt) * decay
  const nextVelocity = (velocity - omega * kick * dt) * decay
  if (Math.abs(next - target) < 0.03 && Math.abs(nextVelocity) < 0.2) {
    return { position: target, velocity: 0 }
  }
  return { position: next, velocity: nextVelocity }
}

/** How many pieces a swipe lands on. `velocity` is pixels per millisecond. */
export function mobileFocus(
  focus: number,
  count: number,
  delta: number,
  velocity: number,
  step: number,
): number {
  if (count <= 0) return 0
  let shift = step > 0 ? Math.round(-delta / step) : 0
  if (shift === 0 && Math.abs(delta) > 22 && Math.abs(velocity) > 0.35) {
    shift = delta < 0 ? 1 : -1
  }
  return Math.max(0, Math.min(count - 1, focus + shift))
}

/** Offset that keeps the landing piece where the finger left it. */
export function handoffOffset(delta: number, from: number, to: number, step: number): number {
  return delta + (to - from) * step
}
