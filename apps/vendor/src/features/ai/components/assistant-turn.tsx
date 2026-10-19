"use client"

import type {
  AgentApprovalDecision,
  AssistantPart,
  TaskPlanResult,
  VendorAgentToolEvent,
} from "@/features/ai/lib/types"
import type { Locale } from "@/features/ai/lib/humanize-tool"
import { renderLightMarkdown } from "@/features/ai/lib/light-markdown"
import { ToolEventRenderer } from "./tool-cards/tool-event-renderer"
import { ActionRow, actionHasCard } from "./tool-cards/action-row"
import { ApprovalCard } from "./tool-cards/approval-card"
import { TurnErrorCard } from "./tool-cards/turn-error-card"
import { TaskPlanCard } from "./tool-cards/task-plan-card"

/** A form-handoff intent surfaces as its own prominent CTA card, not a
 * collapsed action row — and so does a change staged into the form that
 * handoff opened (`form_patch`), which is the same conversation about the
 * same form. Both stay out of the repeat-folding and the auto-expand below. */
function isNavigate(event: VendorAgentToolEvent): boolean {
  return (
    event.ok &&
    typeof event.result === "object" &&
    event.result !== null &&
    ("navigate_to_form" in (event.result as object) ||
      "form_patch" in (event.result as object))
  )
}

/** The plan checklist ("To-dos"). The agent re-emits it after every step and
 * across turns, so a turn renders its own last snapshot and only the turn
 * holding the conversation's newest one renders at all — see `planIsCurrent`
 * and `lib/task-plan.ts`. */
function isTaskPlan(event: VendorAgentToolEvent): boolean {
  return event.name === "set_task_plan"
}

/** Key-order-independent identity for a tool call, so the same lookup issued
 * twice folds even when the model serialized its arguments differently. */
function callKey(event: VendorAgentToolEvent): string {
  const args = event.args ?? {}
  const stable = Object.keys(args)
    .sort()
    .map((k) => `${k}=${JSON.stringify(args[k])}`)
    .join("&")
  return `${event.name}(${stable})`
}

/**
 * Build the ordered part list. Prefers the server/stream `parts` (true
 * chronological interleaving). Falls back for legacy turns — persisted before
 * `parts` existed — to a single leading text block followed by the flat
 * tool_events, which is the best ordering recoverable from the old shape.
 */
function resolveParts(
  parts: AssistantPart[] | undefined,
  content: string,
  toolEvents: VendorAgentToolEvent[] | undefined,
): AssistantPart[] {
  if (parts && parts.length) return parts
  const out: AssistantPart[] = []
  if (content.trim()) out.push({ kind: "text", text: content })
  for (const event of toolEvents ?? []) out.push({ kind: "tool", event })
  return out
}

/**
 * Collapse a lookup the model issued twice with identical arguments into one
 * row carrying a repeat count.
 *
 * A weak model re-queries when its first attempt found nothing — an Arabic
 * category label against an English taxonomy did exactly that — and the log
 * then reads as if the assistant did the same thing twice, with the first row
 * opening onto the same list as the second. Only successful calls fold: an
 * error followed by a retry is two different outcomes and both belong on
 * screen. The retained part is the LAST occurrence, so the row shows the
 * newest state rather than freezing on a pending first attempt.
 */
function foldRepeats(
  parts: AssistantPart[],
): Array<{ part: AssistantPart; index: number; repeat: number }> {
  const out: Array<{ part: AssistantPart; index: number; repeat: number }> = []
  const seen = new Map<string, number>()

  parts.forEach((part, index) => {
    if (
      part.kind === "tool" &&
      part.event.ok &&
      !isTaskPlan(part.event) &&
      !isNavigate(part.event)
    ) {
      const key = callKey(part.event)
      const at = seen.get(key)
      if (at !== undefined) {
        out[at] = { part, index, repeat: out[at].repeat + 1 }
        return
      }
      seen.set(key, out.length)
    }
    out.push({ part, index, repeat: 1 })
  })

  return out
}

interface Props {
  parts?: AssistantPart[]
  content: string
  toolEvents?: VendorAgentToolEvent[]
  currency: string
  locale: Locale
  /** Highlight query from the in-conversation find bar (text parts only). */
  highlightQuery?: string
  /** Show a blinking caret after the trailing text — set while streaming. */
  caret?: boolean
  /** Wired only for the turn whose approval is actually still pending on the
   * server. Absent everywhere else, which is what makes historical approval
   * cards render read-only instead of offering buttons that would 404. */
  onApprovalDecide?: (decisions: AgentApprovalDecision[]) => void
  approvalBusy?: boolean
  /** Wired only for the latest turn, so a failure the vendor can still act on
   * offers a retry and a historical one is a plain record. */
  onRetry?: () => void
  retrying?: boolean
  /** Sends a message on the vendor's behalf. Lets a result card offer a
   * choice — picking a category, say — instead of making them retype it.
   * Absent in the read-only shared view. */
  onSuggest?: (text: string) => void
  /** Where the plan screen is, for the one turn failure a vendor can act on:
   * their own allowance running out. Absent in the shared read-only view,
   * where the reader has no plan to look at. */
  planHref?: string
  /**
   * Whether this turn holds the conversation's newest `set_task_plan`
   * snapshot. False on every older turn that also carries one.
   *
   * A turn cannot work this out for itself — it sees only its own `parts` —
   * and the flow the prompt prescribes (hand off to a form, vendor saves,
   * chat auto-resumes) guarantees the re-sends land in *different* turns. So
   * the within-turn dedup that used to be the whole rule produced one frozen
   * To-do card per turn, stacked down the transcript. Defaults to true so a
   * caller that does not care (the render tests) keeps the old behaviour.
   */
  planIsCurrent?: boolean
}

/**
 * Renders one assistant turn as a Shopify-style work log: narration and
 * humanized action rows interleaved in the exact order they happened, with
 * the final data-bearing action expanded and the intermediate lookups
 * collapsed to quiet one-liners. Form handoffs render as prominent CTA cards;
 * the plan checklist ("To-dos") renders once per turn as its latest snapshot.
 */
export function AssistantTurn({
  parts,
  content,
  toolEvents,
  currency,
  locale,
  highlightQuery = "",
  caret = false,
  onApprovalDecide,
  approvalBusy = false,
  onRetry,
  retrying = false,
  onSuggest,
  planHref,
  planIsCurrent = true,
}: Props) {
  const resolved = foldRepeats(resolveParts(parts, content, toolEvents))
  const lastIdx = resolved.length - 1

  // Auto-expand the LAST successful data-bearing action; collapse the rest so
  // a multi-step turn reads as "steps → answer", not a wall of cards.
  let lastCardIdx = -1
  resolved.forEach(({ part }, i) => {
    if (
      part.kind === "tool" &&
      !isNavigate(part.event) &&
      actionHasCard(part.event)
    ) {
      lastCardIdx = i
    }
  })

  // The agent re-sends the plan after every step; show only the last one so a
  // single "To-dos" card tracks progress instead of stacking a card per call.
  let lastTaskPlanIdx = -1
  resolved.forEach(({ part }, i) => {
    if (part.kind === "tool" && isTaskPlan(part.event)) lastTaskPlanIdx = i
  })

  return (
    <div className="space-y-2">
      {resolved.map(({ part, index, repeat }, i) => {
        if (part.kind === "text") {
          if (!part.text.trim()) return null
          return (
            <div
              key={index}
              dir="auto"
              className="w-fit max-w-full rounded-2xl bg-muted px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]"
            >
              {renderLightMarkdown(part.text, highlightQuery)}
              {caret && i === lastIdx && (
                <span
                  aria-hidden="true"
                  className="ms-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle motion-reduce:animate-none"
                />
              )}
            </div>
          )
        }

        if (part.kind === "approval") {
          return (
            <ApprovalCard
              key={index}
              requests={part.requests}
              decisions={part.decisions}
              onDecide={onApprovalDecide}
              busy={approvalBusy}
            />
          )
        }

        if (part.kind === "error") {
          return (
            <TurnErrorCard
              key={index}
              code={part.code}
              message={part.message}
              retryable={part.retryable}
              onRetry={onRetry}
              retrying={retrying}
              planHref={planHref}
            />
          )
        }

        const event = part.event
        if (isTaskPlan(event)) {
          // Within this turn, only the last re-send; across turns, only the
          // newest. Rendered directly rather than through the dispatcher so
          // the terminal state can be passed down: a turn that has finished
          // with a step still `active` is waiting on the vendor, not working.
          if (i !== lastTaskPlanIdx || !planIsCurrent) return null
          return (
            <TaskPlanCard
              key={index}
              result={event.result as TaskPlanResult}
              waiting={!caret}
            />
          )
        }
        if (isNavigate(event)) {
          return (
            <ToolEventRenderer
              key={index}
              event={event}
              currency={currency}
              locale={locale}
            />
          )
        }
        return (
          <ActionRow
            key={index}
            event={event}
            currency={currency}
            locale={locale}
            repeat={repeat}
            defaultExpanded={i === lastCardIdx}
            onSuggest={onSuggest}
          />
        )
      })}
    </div>
  )
}
