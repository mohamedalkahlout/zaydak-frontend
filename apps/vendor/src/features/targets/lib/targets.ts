import {
  bpsToPercent,
  centsToMajor,
  formatMoneyCents,
  majorToCents,
  percentToBps,
} from "@/shared/lib/format"
import type { TargetMetric, TargetPeriod, TargetStatus, TargetUnit } from "../types"

/** Metric order in the picker (money first, then count, then rate). */
export const METRIC_OPTIONS: TargetMetric[] = [
  "TOTAL_SALES",
  "NET_SALES",
  "GROSS_SALES",
  "NET_PROFIT",
  "AOV",
  "ORDERS_COUNT",
  "RETURNING_CUSTOMER_RATE",
]

export const PERIOD_OPTIONS: TargetPeriod[] = [
  "WEEK",
  "MONTH",
  "QUARTER",
  "YEAR",
  "CUSTOM",
]

/** Mirror of the back-end metricUnit — the unit is a pure function of metric. */
export function metricUnit(metric: TargetMetric): TargetUnit {
  switch (metric) {
    case "ORDERS_COUNT":
      return "count"
    case "RETURNING_CUSTOMER_RATE":
      return "rate"
    default:
      return "money"
  }
}

/** Render an integer value (cents/count/bps) in its unit. */
export function formatTargetValue(
  value: number | null | undefined,
  unit: TargetUnit,
  currency = "SAR",
): string {
  if (value == null) return "—"
  if (unit === "money") return formatMoneyCents(value, currency)
  if (unit === "rate") return `${bpsToPercent(value).toFixed(1)}%`
  return value.toLocaleString()
}

/** Convert a human-entered value to the wire integer for a unit. */
export function toWireValue(display: number, unit: TargetUnit): number {
  if (unit === "money") return majorToCents(display)
  if (unit === "rate") return percentToBps(display)
  return Math.round(display)
}

/** Convert a wire integer back to the human-facing value for a unit (edit prefill). */
export function fromWireValue(value: number, unit: TargetUnit): number {
  if (unit === "money") return centsToMajor(value)
  if (unit === "rate") return bpsToPercent(value)
  return value
}

// Concrete gauge colours per live status (recharts can't read Tailwind).
const STATUS_COLOR: Record<TargetStatus, string> = {
  DRAFT: "#94a3b8", // slate-400
  UPCOMING: "#64748b", // slate-500
  IN_PROGRESS: "#0d9488", // brand teal
  ACHIEVED: "#059669", // emerald-600
  NOT_ACHIEVED: "#e11d48", // rose-600
}

export function statusColor(status: TargetStatus): string {
  return STATUS_COLOR[status]
}

// Badge skin per status (Tailwind, both themes).
const STATUS_BADGE: Record<TargetStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  UPCOMING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  ACHIEVED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  NOT_ACHIEVED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
}

export function statusBadgeClass(status: TargetStatus): string {
  return STATUS_BADGE[status]
}
