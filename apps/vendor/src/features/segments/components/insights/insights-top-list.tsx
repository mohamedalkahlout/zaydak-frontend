"use client"

import { useLocale } from "next-intl"
import type { InsightsValueCount } from "@/features/segments/types"
import { cn } from "@/shared/lib/utils"

/**
 * Horizontal bar list ranked by count. Used for Top Countries / Cities /
 * Languages in the Insights tab. Renders an inline bar that's proportional
 * to the largest entry — no external chart library, no SVG.
 */

interface InsightsTopListProps {
  title: string
  items: InsightsValueCount[]
  /** Optional value formatter — e.g. country codes → display names. */
  formatValue?: (value: string) => string
}

export function InsightsTopList({
  title,
  items,
  formatValue,
}: InsightsTopListProps) {
  const locale = useLocale()
  const max = items.length ? items[0].count : 0
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="py-4 text-sm text-muted-foreground">—</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const pct = max > 0 ? (item.count / max) * 100 : 0
            return (
              <li key={item.value}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {formatValue ? formatValue(item.value) : item.value}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {item.count.toLocaleString(locale)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
