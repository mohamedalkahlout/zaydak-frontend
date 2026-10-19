"use client"

import { useTranslations } from "next-intl"
import { LoaderIcon, PauseIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import type { TaskPlanStep } from "@/features/ai/lib/types"
import { planProgress } from "@/features/ai/lib/task-plan"

interface Props {
  steps: readonly TaskPlanStep[]
  /** A turn is streaming right now, so the current step is actually running. */
  running?: boolean
  className?: string
}

/**
 * A one-line "where am I in this plan" strip, pinned above the composer.
 *
 * It exists because of the gap the transcript cannot cover. A multi-step
 * request sends the vendor away from the chat — to a product form, then to a
 * coupon form — and the panel travels with them (it lives in `DashboardShell`,
 * so it survives the navigation), but everything that said which step they
 * were on was a card scrolled up inside the log. The strip is the part that
 * stays put while they are working somewhere else.
 *
 * Deliberately not the whole checklist: the card in the transcript is still
 * the full list, and a second copy of it in a 340px panel would crowd out the
 * conversation. This says the count, the step, and whether the agent is
 * working or waiting on them.
 *
 * Hidden once every step is done. A finished plan is history, and history
 * belongs in the log rather than pinned over it.
 */
export function TaskPlanStrip({ steps, running = false, className }: Props) {
  const t = useTranslations("aiChat.taskPlan")
  const { done, total, current, complete } = planProgress(steps)

  if (!total || complete || !current) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-card/80 px-3 py-2 text-xs backdrop-blur",
        className,
      )}
    >
      {running ? (
        <LoaderIcon className="size-3.5 shrink-0 animate-spin text-violet-500 motion-reduce:animate-none" />
      ) : (
        <PauseIcon
          className="size-3.5 shrink-0 text-violet-500"
          strokeWidth={3}
        />
      )}
      <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
        {t("stepOf", { current: done + 1, total })}
      </span>
      <span className="truncate" dir="auto">
        {current.title}
      </span>
      <span className="ms-auto shrink-0 text-muted-foreground">
        {running ? t("working") : t("waiting")}
      </span>
    </div>
  )
}
