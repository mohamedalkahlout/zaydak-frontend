"use client"

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { type Delta, formatDeltaPct } from "../lib/metrics"

/**
 * Period-over-period change pill. `goodWhen` flips the color semantics for
 * metrics where a decrease is the desirable direction (discounts, returns).
 */
export function DeltaBadge({
  delta,
  goodWhen = "up",
  className,
}: {
  delta: Delta
  goodWhen?: "up" | "down"
  className?: string
}) {
  if (delta.direction === "flat" && delta.pct == null) return null

  const isFlat = delta.direction === "flat"
  const isGood = delta.direction === goodWhen
  const Icon = delta.direction === "down" ? ArrowDownIcon : ArrowUpIcon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        isFlat
          ? "bg-muted text-muted-foreground"
          : isGood
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-red-500/10 text-red-600 dark:text-red-400",
        className,
      )}
    >
      {!isFlat && <Icon className="size-3" aria-hidden />}
      {delta.pct != null ? formatDeltaPct(delta.pct) : "—"}
    </span>
  )
}
