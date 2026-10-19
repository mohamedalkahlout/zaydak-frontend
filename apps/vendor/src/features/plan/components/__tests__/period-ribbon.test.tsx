import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { MyPlanEntry, PlanEntry } from "../../types"

// A window that closed on the 8th rendered as a full bar reading "Last day of
// this period" beside "Renews", indefinitely — every one of those three
// statements about a period that had ended. What these pin is that the bar is
// allowed to stay full and the sentences are not.
//
// Boundaries are mocked rather than provided (the repo's component-test
// convention); translations return their key, so assertions read as keys. The
// clock is pinned, because "the past" has to be a fact about the fixture.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

// Imported after the mocks are registered.
import { PeriodRibbon } from "../period-ribbon"

const GROW: PlanEntry = {
  id: "p1",
  code: "grow",
  name: "Grow",
  monthly_price_cents: 2900,
  yearly_price_cents: 29000,
  currency: "SAR",
  trial_days: 14,
  is_public: true,
  is_active: true,
  sort_order: 1,
}

/** The production shape this work came from: Aug 9 -> Sep 8, admin-assigned. */
const my = (over: Partial<MyPlanEntry> = {}): MyPlanEntry => ({
  plan: GROW,
  subscription_id: "sub_local_1",
  status: "ACTIVE",
  interval: "MONTHLY",
  current_period_start: "2026-08-09T00:00:00.000Z",
  current_period_end: "2026-09-08T00:00:00.000Z",
  trial_ends_at: null,
  cancel_at_period_end: false,
  is_fallback: false,
  is_stripe_billed: false,
  billing_enabled: true,
  has_billing_account: false,
  trial_available: false,
  ...over,
})

beforeEach(() => {
  // Only `Date` is faked, so React's scheduler keeps real timers.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-12T09:00:00.000Z"))
})
afterEach(() => vi.useRealTimers())

describe("PeriodRibbon", () => {
  it("states that the period ended instead of counting days left in it", () => {
    render(<PeriodRibbon my={my()} />)

    expect(screen.getByText("ribbonExpired")).toBeTruthy()
    expect(screen.queryByText('ribbonDaysLeft:{"days":0}')).toBeNull()
  })

  it("does not promise a renewal on a date that has gone by", () => {
    render(<PeriodRibbon my={my()} />)

    expect(screen.getByText("ribbonEnded")).toBeTruthy()
    expect(screen.queryByText("ribbonRenews")).toBeNull()
  })

  it("stops promising the quota reset it can no longer deliver", () => {
    render(<PeriodRibbon my={my()} />)

    expect(screen.getByText("ribbonQuotaExpired")).toBeTruthy()
    expect(screen.queryByText("ribbonQuotaResets")).toBeNull()
  })

  it("outranks a scheduled end and a scheduled change, which cannot happen now", () => {
    const { unmount } = render(<PeriodRibbon my={my({ cancel_at_period_end: true })} />)
    expect(screen.getByText("ribbonEnded")).toBeTruthy()
    expect(screen.queryByText("ribbonPlanEnds")).toBeNull()
    unmount()

    render(
      <PeriodRibbon
        my={my({
          pending_plan: { id: "p0", code: "basic", name: "Basic", name_ar: null },
          pending_change_at: "2026-09-08T00:00:00.000Z",
        })}
      />,
    )
    expect(screen.getByText("ribbonEnded")).toBeTruthy()
    expect(screen.queryByText(/^ribbonChangesTo:/)).toBeNull()
  })

  it("leaves a running period saying what it always said", () => {
    render(<PeriodRibbon my={my({ current_period_end: "2026-10-08T00:00:00.000Z" })} />)

    expect(screen.getByText(/^ribbonDaysLeft:/)).toBeTruthy()
    expect(screen.getByText("ribbonRenews")).toBeTruthy()
    expect(screen.queryByText("ribbonExpired")).toBeNull()
  })

  it("draws nothing for a shop on the free fallback", () => {
    // There is no period to draw, and an empty axis would imply one exists.
    const { container } = render(<PeriodRibbon my={my({ is_fallback: true })} />)
    expect(container.firstChild).toBeNull()
  })
})
