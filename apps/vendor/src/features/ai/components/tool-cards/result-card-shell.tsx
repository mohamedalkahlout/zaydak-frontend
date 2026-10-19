import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

interface Props {
  icon: LucideIcon
  title: string
  /** Optional right-aligned meta (a count, a period label, a status). */
  trailing?: ReactNode
  /** Tints the header icon only — the frame stays calm so a stack of
   * different cards still reads as one family. */
  accent?: "violet" | "emerald" | "indigo" | "amber" | "muted"
  children: ReactNode
  className?: string
}

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  violet: "text-violet-600 dark:text-violet-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  amber: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
}

/**
 * The single frame every tool result card renders inside, so a search
 * result, a stats panel, and a coupon list all read as one calm family —
 * same border, radius, header rhythm, and body padding. Only the header
 * icon carries an accent tint; the frame itself never shouts.
 */
export function ResultCardShell({
  icon: Icon,
  title,
  trailing,
  accent = "muted",
  children,
  className,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs font-medium">
        <Icon className={cn("size-3.5 shrink-0", ACCENT[accent])} />
        <span className="truncate">{title}</span>
        {trailing != null && (
          <span className="ms-auto shrink-0 text-muted-foreground">
            {trailing}
          </span>
        )}
      </div>
      <div className={cn("p-3", className)}>{children}</div>
    </div>
  )
}
