import type {
  AttributionChannel,
  AttributionDimension,
  AttributionModel,
  AttributionRow,
} from "../types"

export const DIMENSION_OPTIONS: AttributionDimension[] = [
  "CHANNEL",
  "SOURCE",
  "MEDIUM",
  "CAMPAIGN",
]

export const CHANNEL_OPTIONS: AttributionChannel[] = [
  "DIRECT",
  "ORGANIC_SEARCH",
  "PAID_SEARCH",
  "SOCIAL",
  "PAID_SOCIAL",
  "EMAIL",
  "REFERRAL",
  "AFFILIATE",
  "OTHER",
]

// P1 only supports the single-touch models (multi-touch needs the event pipeline).
export const MODEL_OPTIONS: AttributionModel[] = ["LAST_TOUCH", "FIRST_TOUCH"]

// Concrete per-channel colours for the revenue bar chart (recharts can't read
// Tailwind). Rows grouped by source/campaign colour by their dominant channel.
const CHANNEL_COLOR: Record<AttributionChannel, string> = {
  DIRECT: "#64748b", // slate-500
  ORGANIC_SEARCH: "#0d9488", // teal
  PAID_SEARCH: "#2563eb", // blue-600
  SOCIAL: "#db2777", // pink-600
  PAID_SOCIAL: "#c026d3", // fuchsia-600
  EMAIL: "#d97706", // amber-600
  REFERRAL: "#7c3aed", // violet-600
  AFFILIATE: "#059669", // emerald-600
  OTHER: "#a1a1aa", // zinc-400
}

export function channelColor(channel: AttributionChannel | null): string {
  return channel ? CHANNEL_COLOR[channel] : CHANNEL_COLOR.OTHER
}

// A group's revenue is net of refunds settled in the window, and a refund can
// belong to an order placed before the window opened. Such a group can carry
// zero orders and negative revenue, and a ratio over it means nothing: ROAS
// over negative revenue reads as a negative return, AOV over zero orders is a
// division by zero. The helpers below return null wherever a figure has no
// honest value, and the page prints null as an em dash. They also refuse a
// non-finite or negative input, whichever API version sent it.

function finiteNonNegative(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * ROAS as a multiple of spend (`roas_bps` 25000 is 2.5), or null. A group
 * whose revenue is negative has none: the API nulls it there, and an API older
 * than that rule sends a negative ratio, which this drops. Zero revenue with
 * spend is a real answer, as the API has it: spent and sold nothing, 0.00x —
 * a dash there would read like the dash of a group with no spend at all.
 */
export function roasMultiple(
  row: Pick<AttributionRow, "revenue_cents" | "roas_bps">,
): number | null {
  if (!(row.revenue_cents >= 0)) return null
  const bps = finiteNonNegative(row.roas_bps)
  return bps == null ? null : bps / 10000
}

/** Spend per new customer in cents, or null when the API has none. */
export function cacCents(
  row: Pick<AttributionRow, "cac_cents">,
): number | null {
  return finiteNonNegative(row.cac_cents)
}

/**
 * Average order value in cents, or null for a group with no orders in the
 * window (the API sends 0 there) or with refunds outweighing its sales.
 */
export function aovCents(
  row: Pick<AttributionRow, "orders" | "aov_cents">,
): number | null {
  if (!(row.orders > 0)) return null
  return finiteNonNegative(row.aov_cents)
}

/** True when any group, or the total, ended the window below zero. */
export function hasNegativeRevenue(
  rows: ReadonlyArray<Pick<AttributionRow, "revenue_cents">>,
): boolean {
  return rows.some((row) => row.revenue_cents < 0)
}
