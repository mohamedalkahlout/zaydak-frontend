import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { MyPlanEntry } from "../../types"

// The card is permanent, so what these tests pin is that each state says its own
// true thing — and that the paying, up-to-date state states a fact rather than
// growing a button asking for something the vendor has already done. The card
// was hardcoded once; the point of every case here is that nothing in it is.
//
// Boundaries are mocked rather than provided (the repo's component-test
// convention); translations return their key, so assertions read as keys. Dates
// are matched by prefix, not by value — `toLocaleDateString` output depends on
// the machine's ICU data and timezone, and what is under test is which sentence
// is chosen, not how a date is spelled.

let plan: MyPlanEntry | undefined
let loading = false

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: plan ? { myPlan: { success: true, data: plan } } : undefined,
    loading,
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Imported after the mocks are registered.
import { PlanStatusCard } from "../plan-status-card"

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

const PLUS = {
  ...GROWTH,
  id: "p2",
  code: "plus",
  name: "Plus",
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

beforeEach(() => {
  // The clock is pinned inside the fixture's own Aug 1 -> Sep 1 window. Since
  // `subscriptionState` learned to read an expired period, a real clock would
  // make every case here depend on the day the suite runs: the same fixture is
  // "current" in August and "expired" afterwards. Only `Date` is faked —
  // React's scheduler still gets real timers.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"))
  plan = myPlan()
  loading = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PlanStatusCard", () => {
  it("names the plan and its renewal date when the store is paying and up to date", () => {
    render(<PlanStatusCard shopSlug="acme" />)

    expect(screen.getByText("yourPlan")).toBeTruthy()
    expect(screen.getByText("Growth")).toBeTruthy()
    // Quiet text, not the white call-to-action block: there is nothing to ask
    // for, and a button here is the upsell this card used to be.
    expect(screen.getByText(/^renewsOn:/).tagName).toBe("P")
  })

  it("prefers a scheduled downgrade to the renewal date", () => {
    plan = myPlan({
      pending_plan: { id: "p0", code: "basic", name: "Basic", name_ar: null },
      pending_change_at: "2026-09-01T00:00:00.000Z",
    })
    render(<PlanStatusCard shopSlug="acme" />)

    expect(screen.getByText(/^changesOn:.*Basic/)).toBeTruthy()
    expect(screen.queryByText(/^renewsOn:/)).toBeNull()
  })

  it("says nothing below the plan name when there is no period to renew", () => {
    // A subscription an admin opened by hand, with no Stripe window behind it.
    plan = myPlan({ current_period_start: null, current_period_end: null })
    render(<PlanStatusCard shopSlug="acme" />)

    expect(screen.getByText("Growth")).toBeTruthy()
    expect(screen.queryByText(/^renewsOn:/)).toBeNull()
  })

  it("keeps the call to action on a state that is asking for something", () => {
    plan = myPlan({ status: "PAST_DUE" })
    render(<PlanStatusCard shopSlug="acme" />)

    expect(screen.getByText("sidebarPaymentFailed")).toBeTruthy()
    expect(screen.getByText("sidebarFixPayment").tagName).toBe("DIV")
  })

  it("counts the trial down instead of stating a renewal", () => {
    plan = myPlan({ status: "TRIALING", trial_ends_at: "2026-08-20T00:00:00.000Z" })
    render(<PlanStatusCard shopSlug="acme" />)

    expect(screen.getByText(/^sidebarTrialDays:/)).toBeTruthy()
    expect(screen.getByText("sidebarChoosePlan")).toBeTruthy()
    expect(screen.queryByText("yourPlan")).toBeNull()
  })

  it("asks for a plan once the period has closed, instead of counting to it", () => {
    // The production shape the expired state was added for: an admin-assigned
    // row whose window ended and which nothing renewed. Before, this rendered
    // the quiet "your plan / renews <a past date>" line indefinitely.
    vi.setSystemTime(new Date("2026-09-12T00:00:00.000Z"))
    plan = myPlan({ is_stripe_billed: false })
    render(<PlanStatusCard shopSlug="acme" />)

    expect(screen.getByText("sidebarExpired")).toBeTruthy()
    expect(screen.queryByText(/^renewsOn:/)).toBeNull()
    // Asking for something, so the call-to-action block rather than quiet text.
    expect(screen.getByText("sidebarSeePlans").tagName).toBe("DIV")
  })

  it("links the whole card at the plan overview", () => {
    render(<PlanStatusCard shopSlug="acme" />)
    expect(screen.getByRole("link").getAttribute("href")).toBe("/plan/acme")
  })

  it("renders nothing with no shop in the URL", () => {
    const { container } = render(<PlanStatusCard shopSlug={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("shows a skeleton while this shop's plan is loading", () => {
    // The mount path after a store switch: network-only, no result yet. The
    // previous shop's Plus must not sit here for a frame.
    plan = undefined
    loading = true
    render(<PlanStatusCard shopSlug="beta" />)

    expect(screen.getByTestId("plan-status-card-skeleton")).toBeTruthy()
    expect(screen.queryByText("Plus")).toBeNull()
    expect(screen.queryByText("Growth")).toBeNull()
    expect(screen.queryByText("yourPlan")).toBeNull()
  })

  it("does not paint the previous shop's plan while the next shop is loading", () => {
    // Apollo can still hand the old ROOT_QUERY.myPlan back for a tick after the
    // URL moves — ShopCacheBoundary clears in an effect, after paint. While
    // `loading` is true the card must prefer the skeleton over that foreign
    // result.
    plan = myPlan({ plan: PLUS })
    loading = false
    const view = render(<PlanStatusCard shopSlug="shop-a" />)
    expect(screen.getByText("Plus")).toBeTruthy()

    loading = true
    view.rerender(<PlanStatusCard shopSlug="shop-b" />)

    expect(screen.getByTestId("plan-status-card-skeleton")).toBeTruthy()
    expect(screen.queryByText("Plus")).toBeNull()

    plan = myPlan({ plan: GROWTH })
    loading = false
    view.rerender(<PlanStatusCard shopSlug="shop-b" />)

    expect(screen.getByText("Growth")).toBeTruthy()
    expect(screen.queryByText("Plus")).toBeNull()
    expect(screen.queryByTestId("plan-status-card-skeleton")).toBeNull()
  })
})
