import type { ReturnEntry } from "@/features/returns/types"

export const RETURN_VIEWS = [
  "all",
  "requested",
  "approved",
  "in_transit",
  "received",
  "closed",
  "rejected",
] as const
export type ReturnView = (typeof RETURN_VIEWS)[number]

export function matchReturn(
  entry: ReturnEntry,
  search: string,
  view: ReturnView,
): boolean {
  if (view !== "all" && entry.status !== view) return false
  const q = search.trim().toLowerCase()
  if (!q) return true
  return (
    `#r-${entry.id.slice(-6)}`.includes(q) ||
    (entry.reason ?? "").toLowerCase().includes(q) ||
    (entry.note ?? "").toLowerCase().includes(q) ||
    entry.order_id.toLowerCase().includes(q)
  )
}
