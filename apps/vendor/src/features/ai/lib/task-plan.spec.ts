import { describe, expect, it } from "vitest"
import { hasPlan, latestPlan, planProgress } from "./task-plan"
import type {
  AssistantPart,
  TaskPlanStep,
  VendorAgentMessage,
} from "@/features/ai/lib/types"

/**
 * Reading the plan as conversation state.
 *
 * The shape these tests exist for is the one the back-end prompt prescribes
 * and the transcript could not see: "create a hoodie for 200 then a 15%
 * coupon on it" runs as TWO assistant turns, because the product has no id
 * until the vendor saves the form, and the chat auto-resumes afterwards. Both
 * turns call `set_task_plan`. Deduping inside a turn — which is all a turn can
 * do — left one frozen To-do card per turn stacked down the log.
 */

const planEvent = (steps: TaskPlanStep[]): AssistantPart => ({
  kind: "tool",
  event: {
    name: "set_task_plan",
    args: {},
    ok: true,
    result: { ok: true, task_plan: { steps } },
  },
})

const turn = (id: string, parts: AssistantPart[]): VendorAgentMessage => ({
  id,
  role: "assistant",
  content: "",
  parts,
  created_at: "2026-09-16T00:00:00Z",
})

const STEP_1 = "إنشاء منتج"
const STEP_2 = "كوبون 15% على المنتج"

describe("latestPlan", () => {
  it("is null when the conversation has no plan", () => {
    expect(latestPlan([turn("m1", [{ kind: "text", text: "مرحبا" }])])).toBeNull()
  })

  it("picks the newest snapshot across turns, not within one", () => {
    const first = turn("m1", [
      planEvent([
        { title: STEP_1, status: "active" },
        { title: STEP_2, status: "pending" },
      ]),
    ])
    const second = turn("m2", [
      planEvent([
        { title: STEP_1, status: "done" },
        { title: STEP_2, status: "active" },
      ]),
    ])

    const plan = latestPlan([first, second])
    expect(plan?.messageId).toBe("m2")
    expect(plan?.steps[0]?.status).toBe("done")
  })

  it("takes the last re-send inside the newest turn", () => {
    const only = turn("m1", [
      planEvent([{ title: STEP_1, status: "active" }]),
      { kind: "text", text: "جهزت المنتج." },
      planEvent([{ title: STEP_1, status: "done" }]),
    ])

    expect(latestPlan([only])?.steps[0]?.status).toBe("done")
  })

  it("reads a legacy turn, persisted before parts existed", () => {
    const legacy: VendorAgentMessage = {
      id: "m1",
      role: "assistant",
      content: "",
      tool_events: [
        {
          name: "set_task_plan",
          args: {},
          ok: true,
          result: { ok: true, task_plan: { steps: [{ title: STEP_1, status: "done" }] } },
        },
      ],
      created_at: "2026-09-16T00:00:00Z",
    }

    expect(latestPlan([legacy])?.steps[0]?.title).toBe(STEP_1)
  })

  it("ignores a failed set_task_plan and an empty list", () => {
    const failed = turn("m1", [
      {
        kind: "tool",
        event: { name: "set_task_plan", args: {}, ok: false, result: null },
      },
    ])
    const empty = turn("m2", [planEvent([])])

    expect(latestPlan([failed, empty])).toBeNull()
  })
})

describe("hasPlan", () => {
  it("sees a snapshot in a live turn's parts", () => {
    expect(hasPlan([planEvent([{ title: STEP_1, status: "active" }])])).toBe(true)
  })

  it("is false for a turn that is only narrating", () => {
    expect(hasPlan([{ kind: "text", text: "خليني أشوف المخزون." }])).toBe(false)
    expect(hasPlan(undefined)).toBe(false)
  })
})

describe("planProgress", () => {
  it("names the active step and counts what is finished", () => {
    const p = planProgress([
      { title: STEP_1, status: "done" },
      { title: STEP_2, status: "active" },
    ])

    expect(p).toMatchObject({ done: 1, total: 2, activeIndex: 1, complete: false })
    expect(p.current?.title).toBe(STEP_2)
  })

  it("falls forward to the next unfinished step when none is marked active", () => {
    // The model does not always mark one. A strip with no step to name is
    // worse than one naming the step that has to happen next.
    const p = planProgress([
      { title: STEP_1, status: "done" },
      { title: STEP_2, status: "pending" },
    ])

    expect(p.activeIndex).toBe(-1)
    expect(p.current?.title).toBe(STEP_2)
  })

  it("is complete only when every step is done", () => {
    expect(
      planProgress([
        { title: STEP_1, status: "done" },
        { title: STEP_2, status: "done" },
      ]).complete,
    ).toBe(true)
    expect(planProgress([]).complete).toBe(false)
  })
})
