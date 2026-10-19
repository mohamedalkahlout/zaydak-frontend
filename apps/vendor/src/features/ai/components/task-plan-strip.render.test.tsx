import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { setTestLocale } from "@/features/ai/test-utils/next-intl"
import { TaskPlanStrip } from "./task-plan-strip"
import type { TaskPlanStep } from "@/features/ai/lib/types"

vi.mock("next-intl", async () =>
  (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
)

/**
 * The pinned progress strip.
 *
 * It covers the stretch the transcript cannot: a multi-step request sends the
 * vendor to a product form, then to a coupon form, and the panel travels with
 * them while the log does not follow. Everything that said which step they
 * were on used to be a card scrolled up inside that log.
 */

const STEPS: TaskPlanStep[] = [
  { title: "إنشاء منتج", status: "done" },
  { title: "كوبون 15% على المنتج", status: "active" },
]

beforeEach(() => setTestLocale("en"))

describe("<TaskPlanStrip />", () => {
  it("names the step and where it sits in the plan", () => {
    setTestLocale("ar")
    render(<TaskPlanStrip steps={STEPS} />)

    expect(screen.getByText("الخطوة 2 من 2")).toBeDefined()
    expect(screen.getByText("كوبون 15% على المنتج")).toBeDefined()
  })

  it("says the agent is waiting when no turn is streaming", () => {
    // Every form-handoff turn ends *because* it is waiting on the vendor, so
    // this is the normal state of a multi-step plan, not an edge case.
    render(<TaskPlanStrip steps={STEPS} />)

    expect(screen.getByText("waiting on you")).toBeDefined()
  })

  it("says it is working while a turn streams", () => {
    render(<TaskPlanStrip steps={STEPS} running />)

    expect(screen.getByText("working")).toBeDefined()
    expect(screen.queryByText("waiting on you")).toBeNull()
  })

  it("disappears once every step is done", () => {
    // A finished plan is history; history belongs in the log, not pinned
    // over it for the rest of the conversation.
    setTestLocale("ar")
    const { container } = render(
      <TaskPlanStrip
        steps={STEPS.map((s) => ({ ...s, status: "done" as const }))}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders nothing for an empty plan", () => {
    setTestLocale("ar")
    const { container } = render(<TaskPlanStrip steps={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it("announces itself politely rather than interrupting", () => {
    render(<TaskPlanStrip steps={STEPS} />)

    const strip = screen.getByRole("status")
    expect(strip.getAttribute("aria-live")).toBe("polite")
  })
})
