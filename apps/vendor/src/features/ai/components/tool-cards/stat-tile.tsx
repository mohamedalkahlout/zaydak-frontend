import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

/** One labelled figure in a stats card's tile grid. `hint` is the small
 * print under the value — what the figure is net of, or what it is out of. */
export function StatTile({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string
  value: string
  hint?: ReactNode
  emphasis?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "tabular-nums",
          emphasis ? "text-lg font-bold" : "text-base font-semibold",
        )}>
        {value}
      </div>
      {hint != null && (
        <div className="text-[11px] leading-tight text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  )
}
