import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { MyPlanEntry } from "../../types"

// The pane's whole job is to say one true thing about the subscription and
// offer only the actions that apply to it. These tests pin the branches that
// were easy to get wrong by hand: a trial must not be offered a "cancel plan"
// worded for money already paid, a subscription that is already ending must not
// grow a second "keep my plan" button beside the alert's, and a free shop has
// nothing to cancel at all.
//
// Boundaries are mocked rather than provided (the repo's component-test
// convention); translations return their key, so assertions read as keys.

const cancel = vi.fn(() =>
  Promise.resolve({
    data: { cancelMySubscription: { success: true, data: { effective_at: "2026-09-01" } } },
  }),
)
const resume = vi.fn(() =>
  Promise.resolve({
    data: { resumeMySubscription: { success: true, data: { effective_at: "2026-09-01" } } },
  }),
)
const openPortal = vi.fn(() => Promise.resolve({ data: {} }))
const refetch = vi.fn(() => Promise.resolve({ data: {} }))

let plan: MyPlanEntry | undefined

/** Operation name off a gql document, so each fn is keyed to its mutation. */
function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  // The pane reads `myPlan` with `useSuspenseQuery` (the server page preloads
  // it); no `loading` in the result — suspense readers never render without
  // data.
  useSuspenseQuery: () => ({
    data: { myPlan: { success: true, data: plan } },
    refetch,
  }),
  useMutation: (doc: any) => {
    const fn =
      opName(doc) === "CancelMySubscription"
        ? cancel
        : opName(doc) === "ResumeMySubscription"
          ? resume
          : openPortal
    return [fn, { loading: false }]
  },
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/shared/lib/plan-errors", () => ({
  usePlanError: () => (_err: unknown, fallback: string) => ({ message: fallback }),
}))

// Imported after the mocks are registered.
import { PlanSettingsSection } from "../plan-settings-section"

const GROWTH = {
  id: "p1",
  code: "growth",
  name: "Growth",
  name_ar: null,
  description: null,
  description_ar: null,
  monthly_price_cents: 2900,
  yearly_price_cents: 29000,
  currency: "USD",
  trial_days: 14,
  is_public: true,
  is_active: true,
  sort_order: 1,
}

function myPlan(overrides: Partial<MyPlanEntry> = {}): MyPlanEntry {
  return {
    plan: GROWTH,
    subscription_id: "sub_1",
    status: "ACTIVE",
    interval: "MONTHLY",
    current_period_start: "2026-08-01T00:00:00.000Z",
    current_period_end: "2026-09-01T00:00:00.000Z",
    trial_ends_at: null,
    cancel_at_period_end: false,
    is_fallback: false,
    is_stripe_billed: true,
    billing_enabled: true,
    has_billing_account: true,
    trial_available: false,
    ...overrides,
  }
}

/**
 * Every control label on screen, in order.
 *
 * `queryAllByRole` rather than `getAllByRole`, so "no buttons at all" is an
 * empty array to assert on instead of a throw. The primary action is a `Button`
 * rendered as a `Link` — `nativeButton={false}` keeps it a button by role, the
 * way every other link-button in the app is — so it appears here too.
 */
function labels() {
  return screen.queryAllByRole("button").map((b) => b.textContent)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Pinned inside the fixture's own Aug 1 -> Sep 1 window. Since the pane
  // learned to read an expired period, a real clock would make every case here
  // depend on the day the suite runs: the same fixture is a paying shop in
  // August and an expired one afterwards. Only `Date` is faked, so React's
  // scheduler keeps real timers.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"))
  plan = myPlan()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PlanSettingsSection", () => {
  it("offers cancel and change on a paying subscription", () => {
    render(<PlanSettingsSection />)
    expect(labels()).toContain("cancelSubscription")
    expect(labels()).toContain("changePlan")
    expect(screen.getByText("active")).toBeTruthy()
  })

  it("words the trial as a trial, and offers a plan rather than a change", () => {
    plan = myPlan({ status: "TRIALING", trial_ends_at: "2026-08-20T00:00:00.000Z" })
    render(<PlanSettingsSection />)
    expect(labels()).toContain("cancelTrial")
    expect(labels()).toContain("choosePlan")
    expect(labels()).not.toContain("changePlan")
  })

  it("leaves the undo to the alert once an end is already scheduled", () => {
    plan = myPlan({ cancel_at_period_end: true })
    render(<PlanSettingsSection />)
    // One "keep my plan", and it is the alert's — the row adds none.
    expect(labels().filter((l) => l === "resumeSubscription")).toHaveLength(1)
    expect(labels()).not.toContain("cancelSubscription")
  })

  it("offers no cancellation on the free fallback", () => {
    plan = myPlan({
      is_fallback: true,
      is_stripe_billed: false,
      subscription_id: null,
      status: null,
    })
    render(<PlanSettingsSection />)
    expect(labels()).toEqual(["choosePlan"])
  })

  it("explains itself instead of offering buttons when billing is off", () => {
    plan = myPlan({ billing_enabled: false })
    render(<PlanSettingsSection />)
    expect(labels()).toHaveLength(0)
    expect(screen.getByText("changeNote")).toBeTruthy()
    // No Stripe customer to show, so no subscriptions row either.
    expect(screen.queryByText("viewAllSubscriptions")).toBeNull()
  })

  it("confirms before cancelling, with the trial's own wording", () => {
    plan = myPlan({ status: "TRIALING", trial_ends_at: "2026-08-20T00:00:00.000Z" })
    render(<PlanSettingsSection />)

    fireEvent.click(screen.getByRole("button", { name: "cancelTrial" }))
    expect(cancel).not.toHaveBeenCalled()
    expect(
      screen.getByText(/^confirmCancelTrialBody:/),
    ).toBeTruthy()

    // The dialog's confirm carries the same label as the row's button.
    const confirm = screen
      .getAllByRole("button", { name: "cancelTrial" })
      .at(-1)!
    fireEvent.click(confirm)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it("says the plan has expired and offers a plan rather than a change", () => {
    // The bug report's own shape: an admin-assigned row whose window closed on
    // the 8th, read on the 12th. There is nothing left to cancel and nothing
    // for Stripe to move, so the only action is to buy one.
    vi.setSystemTime(new Date("2026-09-12T00:00:00.000Z"))
    plan = myPlan({
      is_stripe_billed: false,
      current_period_end: "2026-09-08T00:00:00.000Z",
    })
    render(<PlanSettingsSection />)

    expect(screen.getByText("alertExpiredTitle")).toBeTruthy()
    expect(labels()).toContain("choosePlan")
    expect(labels()).not.toContain("cancelSubscription")
    expect(labels()).not.toContain("changePlan")
    expect(screen.getByText("sidebarExpired")).toBeTruthy()
  })

  it("points the subscriptions row at the billing tab", () => {
    render(<PlanSettingsSection />)
    const row = screen.getByText("viewAllSubscriptions").closest("a")
    expect(row?.getAttribute("href")).toBe("/plan/acme/billing")
  })
})
