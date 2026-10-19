// Period-over-period delta math + small formatting helpers for the dashboard.

export type DeltaDirection = "up" | "down" | "flat"

export interface Delta {
  /** Percentage change vs the previous period. `null` when it can't be computed. */
  pct: number | null
  direction: DeltaDirection
}

/**
 * Compute the percentage change of `current` relative to `previous`.
 * - `previous == null` (comparison off / unavailable) → no delta.
 * - `previous === 0` → percentage is undefined; direction still reflects the
 *   sign of `current` so the UI can show an up/down arrow without a number.
 */
export function computeDelta(
  current: number,
  previous: number | null | undefined,
): Delta {
  if (previous == null) return { pct: null, direction: "flat" }
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "flat" }
    return { pct: null, direction: current > 0 ? "up" : "down" }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const direction = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat"
  return { pct, direction }
}

/** Basis points (0–10000) → a "12.3%" string. */
export function formatBps(bps: number | null | undefined): string {
  if (bps == null) return "—"
  return `${(bps / 100).toFixed(1)}%`
}

/** Format a signed percentage for a delta badge, e.g. "+12.3%" / "-4.0%". */
export function formatDeltaPct(pct: number): string {
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}
