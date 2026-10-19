"use client"

import { cn } from "@/shared/lib/utils"

/**
 * What a status *looks* like, separated from what it means.
 *
 * Four tones rather than one per `ConnectionState`, because the screen has
 * more states than a merchant has reactions to them: `never` and
 * `disconnected` are both "off, and that is fine", `error` and `unavailable`
 * are both "off, and something is wrong". Collapsing them here is what stops
 * the empty state from being painted in the same red as a failure.
 */
export type PillTone = "live" | "pending" | "off" | "fault"

const TONES: Record<PillTone, { dot: string; text: string; ring: string }> = {
  live: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "bg-emerald-500/10 ring-emerald-500/20",
  },
  pending: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    ring: "bg-amber-500/10 ring-amber-500/20",
  },
  off: {
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    ring: "bg-muted-foreground/8 ring-foreground/10",
  },
  fault: {
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "bg-destructive/8 ring-destructive/20",
  },
}

/**
 * The one status indicator on this screen, used at three sizes and never
 * re-drawn inline.
 *
 * The dot carries a halo only while `pending`, and that is the whole point of
 * having a component: pairing is the single state where nothing on screen
 * changes for up to a minute while the vendor holds a phone up to it, so it is
 * the single state that has to look *alive*. A pulse on the connected dot
 * would spend that signal on the state that needs it least.
 *
 * `aria-hidden` on the dot and a real text label beside it — a colour is not a
 * status to a screen reader, and this is the one thing on the page a merchant
 * is here to read.
 */
export function WhatsAppStatusPill({
  tone,
  label,
  className,
}: {
  tone: PillTone
  label: string
  className?: string
}) {
  const t = TONES[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        t.ring,
        t.text,
        className,
      )}
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  )
}

/** The dot on its own, for rows that already have their own label. */
export function StatusDot({
  tone,
  className,
}: {
  tone: PillTone
  className?: string
}) {
  const t = TONES[tone]
  return (
    <span
      aria-hidden
      className={cn("relative flex size-2 shrink-0", className)}
    >
      {tone === "pending" && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            t.dot,
          )}
        />
      )}
      <span
        className={cn("relative inline-flex size-2 rounded-full", t.dot)}
      />
    </span>
  )
}
