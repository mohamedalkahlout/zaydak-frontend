"use client"

import type { ReactNode } from "react"
import { cn } from "@repo/ui/lib/utils"

/**
 * A titled panel for the non-table sections (the revenue bars, the status
 * split). Same white card and quiet ring as `DataTableCard` so the screen reads
 * as one surface, with a header row that can hold a control on the end.
 *
 * The tables on this screen deliberately do NOT use this — they use
 * `DataTableCard` and the shared header/row/cell primitives, per the console's
 * rule against hand-rolling a bordered div around a bare `Table`.
 */
export function AnalyticsPanel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  )
}
