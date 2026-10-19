import { useTranslations } from "next-intl"
import { CheckIcon, ListChecksIcon, LoaderIcon, PauseIcon } from "lucide-react"
import type { TaskPlanResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: TaskPlanResult
  /**
   * The turn this plan belongs to has finished.
   *
   * An `active` step then means the opposite of what a spinner says. Every
   * form-handoff turn ends *because* it is waiting on the vendor — the agent
   * prepared a product and the plan cannot advance until they save it — so the
   * spinner-that-never-stops was the normal case, not an edge case. It also
   * survived into persisted history, where a plan from last week span forever.
   */
  waiting?: boolean
}

/**
 * Inline "To-dos" checklist rendered in the transcript each time the agent
 * calls set_task_plan. Shows the full ordered list with per-step state, in
 * its natural position in the conversation flow (below the request that
 * triggered it).
 *
 * It renders through `ResultCardShell` like every other data card. It used to
 * draw its own violet frame with `bg-white` panels inside — a bright slab with
 * grey text on it in dark mode, and in light mode the one card in the log with
 * a different radius and tint.
 */
export function TaskPlanCard({ result, waiting = false }: Props) {
  const t = useTranslations("aiChat.taskPlan")
  const steps = result.task_plan.steps
  const done = steps.filter((s) => s.status === "done").length
  const total = steps.length

  return (
    <ResultCardShell
      icon={ListChecksIcon}
      title={t("title")}
      accent="violet"
      trailing={
        <span className="tabular-nums">
          {done}/{total}
        </span>
      }
    >
      <ol className="space-y-1.5">
        {steps.map((step, i) => {
          if (step.status === "done") {
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl text-sm">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckIcon className="size-3" strokeWidth={3} />
                </span>
                <span className="text-muted-foreground line-through decoration-1">
                  {step.title}
                </span>
              </li>
            )
          }
          if (step.status === "active") {
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                {waiting ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <PauseIcon className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  <LoaderIcon className="size-4 shrink-0 animate-spin text-violet-500 motion-reduce:animate-none" />
                )}
                <span className="font-medium">{step.title}</span>
                {waiting && (
                  <span className="text-xs text-muted-foreground">
                    {t("waiting")}
                  </span>
                )}
              </li>
            )
          }
          return (
            <li
              key={i}
              className="flex items-center gap-2 rounded-xl text-sm">
              <span className="grid size-5 shrink-0 place-items-center">
                <span className="size-2.5 rounded-full border border-dashed border-muted-foreground/50" />
              </span>
              <span className="text-muted-foreground">{step.title}</span>
            </li>
          )
        })}
      </ol>
    </ResultCardShell>
  )
}
