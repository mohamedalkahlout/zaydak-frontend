"use client"

import type { ReactNode } from "react"
import { Bones } from "@/shared/components/bones"

/**
 * One headline figure.
 *
 * Uses this console's card chrome (`rounded-xl border border-border bg-card`),
 * matching `DataTableCard`, rather than `@repo/ui`'s `Card` — that one carries
 * the animated proximity glow the vendor dashboard uses, and nothing else in
 * the admin console has it.
 *
 * The label and hint render immediately because they are static text; only the
 * figure waits, and it waits behind a captured bone rather than a hand-drawn
 * bar. `boneName` is per-card: a figure's width varies a lot between "12" and
 * a full GMV amount, so one shared shape would misfit most of the row.
 */
export function StatCard({
  label,
  value,
  hint,
  boneName,
  loading,
}: {
  label: string
  value: ReactNode
  hint?: string
  boneName: string
  loading: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)]">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Bones name={boneName} loading={loading}>
        <span className="font-heading text-2xl font-semibold tabular-nums">
          {value}
        </span>
      </Bones>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  )
}
