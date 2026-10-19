import type {
  AssistantPart,
  TaskPlanStep,
  VendorAgentMessage,
  VendorAgentToolEvent,
} from "@/features/ai/lib/types"

/**
 * The multi-step plan, read as **conversation state** rather than as a thing
 * that happened inside one turn.
 *
 * `set_task_plan` is a pure-UI echo tool and the prompt tells the model to
 * re-send the COMPLETE list after every step — "including when the chat
 * auto-resumes after a save". That instruction is right, and it is also why
 * reading the plan per turn was wrong: the flow the prompt prescribes
 * (hand off to a form → vendor saves → the chat auto-resumes) *guarantees*
 * the re-sends land in separate assistant messages. `AssistantTurn` deduped
 * within its own `parts` and had no knowledge of siblings, so the canonical
 * two-step request ended as two To-do cards stacked down the transcript: the
 * first frozen at [step 1 active / step 2 pending] with a spinner that never
 * stopped, the second at [both done], and nothing marking the older one
 * stale. `apps/vendor/docs/features/ai.md` claimed the opposite, and was
 * true only within a single turn.
 *
 * Everything here is derived from the message list, deliberately. A store
 * would have been easier and would have broken the public share view, which
 * renders the same transcript out of the same messages and has no session of
 * its own to read.
 */

function isTaskPlanEvent(event: VendorAgentToolEvent): boolean {
  return event.name === "set_task_plan"
}

/** The steps a single `set_task_plan` event carries, if it carries any. */
function stepsOf(event: VendorAgentToolEvent): TaskPlanStep[] | null {
  if (!isTaskPlanEvent(event) || !event.ok) return null
  const result = event.result
  if (typeof result !== "object" || result === null) return null
  const plan = (result as { task_plan?: { steps?: unknown } }).task_plan
  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) return null
  return plan.steps as TaskPlanStep[]
}

/** The last plan snapshot inside one turn, in `parts` order. */
function planInParts(
  parts: AssistantPart[] | undefined,
  toolEvents: VendorAgentToolEvent[] | undefined,
): TaskPlanStep[] | null {
  let found: TaskPlanStep[] | null = null
  for (const part of parts ?? []) {
    if (part.kind !== "tool") continue
    const steps = stepsOf(part.event)
    if (steps) found = steps
  }
  if (found) return found
  // Legacy turns, persisted before `parts` existed.
  for (const event of toolEvents ?? []) {
    const steps = stepsOf(event)
    if (steps) found = steps
  }
  return found
}

/**
 * Whether a turn carries a plan snapshot at all.
 *
 * The surfaces need this for the live turn, which is not in `messages` yet:
 * while it is producing its own snapshot it owns the card, and the newest
 * committed turn must stand down so the two do not stack.
 */
export function hasPlan(
  parts: AssistantPart[] | undefined,
  toolEvents?: VendorAgentToolEvent[],
): boolean {
  return planInParts(parts, toolEvents) !== null
}

export interface ConversationPlan {
  steps: TaskPlanStep[]
  /** The message carrying the newest snapshot — the one turn that renders it. */
  messageId: string
}

/**
 * The newest plan in the conversation, or null when there is not one.
 *
 * Scans backwards and stops at the first message that has a snapshot, so the
 * cost is one message on the common path.
 */
export function latestPlan(
  messages: readonly VendorAgentMessage[],
): ConversationPlan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message || message.role !== "assistant") continue
    const steps = planInParts(message.parts, message.tool_events)
    if (steps) return { steps, messageId: message.id }
  }
  return null
}

export interface PlanProgress {
  done: number
  total: number
  /** The step the agent says it is on, or -1 when none is marked active. */
  activeIndex: number
  /** The step to name in a one-line summary: the active one, else the next. */
  current: TaskPlanStep | null
  complete: boolean
}

export function planProgress(steps: readonly TaskPlanStep[]): PlanProgress {
  const total = steps.length
  const done = steps.filter((s) => s.status === "done").length
  const activeIndex = steps.findIndex((s) => s.status === "active")
  const nextIndex =
    activeIndex >= 0 ? activeIndex : steps.findIndex((s) => s.status !== "done")
  return {
    done,
    total,
    activeIndex,
    current: nextIndex >= 0 ? (steps[nextIndex] ?? null) : null,
    complete: total > 0 && done === total,
  }
}
