"use client"

import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

/**
 * Small KPI card used in the Insights tab grid. Pairs a value with a
 * label + optional caption (e.g. "of base", "of members").
 */

interface InsightsStatCardProps {
  label: string
  value: string | number | ReactNode
  caption?: string
  tone?: "default" | "positive" | "muted"
  icon?: ReactNode
}

export function InsightsStatCard({
  label,
  value,
  caption,
  tone = "default",
  icon,
}: InsightsStatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold leading-tight",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {caption && (
        <div className="text-xs text-muted-foreground">{caption}</div>
      )}
    </div>
  )
}
