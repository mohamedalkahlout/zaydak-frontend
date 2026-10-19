import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { setTestLocale } from "@/features/ai/test-utils/next-intl"
import { TurnErrorCard } from "./turn-error-card"

vi.mock("next-intl", async () =>
  (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
)

beforeEach(() => setTestLocale("en"))

/**
 * Three ceilings sit in front of an agent turn and the vendor can do something
 * different about each. The back-end used to answer all three with
 * `QUOTA_EXCEEDED`, so a merchant whose *plan allowance* was spent read "the
 * platform team has been notified — nothing is needed from you" (untrue, and it
 * hid the upgrade), and a merchant who had simply asked sixty questions in an
 * hour read the same sentence.
 *
 * These pin the three apart. An unknown code must still land on the generic
 * card rather than crashing — an older back-end is a supported caller.
 */
describe("TurnErrorCard", () => {
  const base = {
    message: "No.",
    retryable: false,
  }

  const notified = /platform team has been notified/i

  it("offers a way out for the shop's own spent allowance", () => {
    render(
      <TurnErrorCard
        {...base}
        code="QUOTA_EXCEEDED"
        planHref="/store/acme/settings/plan"
      />,
    )

    expect(screen.getByText(/used this period's allowance/i)).toBeTruthy()
    // `Button` + `render={<Link/>}` is the app-wide idiom for a link that
    // looks like a button; base-ui stamps role="button" on the anchor, so the
    // href is what proves it navigates.
    const link = screen.getByRole("button", { name: /view plan/i })
    expect(link.getAttribute("href")).toBe("/store/acme/settings/plan")
    // This one is not the platform's fault and there is something to do.
    expect(screen.queryByText(notified)).toBeNull()
  })

  it("omits the plan link where there is no plan to look at", () => {
    // The shared read-only view renders these for someone who is not the owner.
    render(<TurnErrorCard {...base} code="QUOTA_EXCEEDED" />)

    expect(screen.queryByRole("button", { name: /view plan/i })).toBeNull()
  })

  it("says the team knows for the platform's own cap", () => {
    render(<TurnErrorCard {...base} code="PLATFORM_BUDGET_EXCEEDED" />)

    expect(screen.getByText(/assistant is paused/i)).toBeTruthy()
    expect(screen.getByText(notified)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /view plan/i })).toBeNull()
  })

  it("tells an hourly limit it clears by itself, and blames nobody", () => {
    render(<TurnErrorCard {...base} code="RATE_LIMITED" />)

    expect(screen.getByText(/too many questions/i)).toBeTruthy()
    expect(screen.getByText(/clears on its own/i)).toBeTruthy()
    // Not a platform fault and not a plan problem.
    expect(screen.queryByText(notified)).toBeNull()
    expect(screen.queryByRole("button", { name: /view plan/i })).toBeNull()
  })

  it("still falls back for a code it has never seen", () => {
    // An older back-end, or a new code shipped before this card learns it.
    render(<TurnErrorCard {...base} code="SOMETHING_NEW" />)

    expect(screen.getByText(/reply didn't finish/i)).toBeTruthy()
    expect(screen.queryByText(notified)).toBeNull()
  })

  it("offers retry only when the back-end said the failure is retryable", () => {
    const { rerender } = render(
      <TurnErrorCard {...base} code="STREAM_FAILED" retryable onRetry={() => {}} />,
    )
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy()

    // A spent hourly bucket is retryable in principle and useless in practice,
    // so the back-end sends retryable: false and no button is drawn.
    rerender(<TurnErrorCard {...base} code="RATE_LIMITED" onRetry={() => {}} />)
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull()
  })

  it("renders the Arabic titles under an Arabic locale", () => {
    setTestLocale("ar")
    render(<TurnErrorCard {...base} code="QUOTA_EXCEEDED" planHref="/x" />)

    expect(screen.getByText("انتهت حصتك لهذه الفترة")).toBeTruthy()
    expect(screen.getByRole("button", { name: "عرض الباقة" })).toBeTruthy()
  })
})
