import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  daysUntil,
  hasLiveStripeSubscription,
  isPeriodExpired,
  periodProgress,
  subscriptionState,
} from "../status"
import type { MyPlanEntry, PlanEntry } from "../../types"

// Two defects are pinned here, and both came off the same production row.
//
// The first is a dead end: an admin-assigned subscription is not the fallback
// and does carry a `subscription_id`, so the old predicate read it as a live
// Stripe subscription and quoted a plan change for it. The server answers that
// with `no_live_subscription`, and the vendor could never subscribe at all.
//
// The second is a window that closed and nothing moved. Every sentence the
// screens derive from `subscriptionState` assumed the period was still ahead.
//
// The clock is pinned rather than trusted: "the past" has to be a fact about
// the fixture, not about the machine the suite runs on.

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
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-12T09:00:00.000Z"))
})
afterEach(() => vi.useRealTimers())

describe("hasLiveStripeSubscription", () => {
  it("sends the free fallback to Checkout", () => {
    expect(
      hasLiveStripeSubscription(
        my({
          is_fallback: true,
          is_stripe_billed: false,
          subscription_id: null,
          status: null,
        }),
      ),
    ).toBe(false)
  })

  it("sends an admin-assigned subscription to Checkout", () => {
    // The regression. This row has a `subscription_id` and is not the
    // fallback, so the old predicate returned true and routed it to
    // `previewPlanChange` — which the server answers with
    // `no_live_subscription`, because there is nothing at Stripe to prorate.
    expect(hasLiveStripeSubscription(my())).toBe(false)
  })

  it("charges a Stripe-backed subscription in place", () => {
    // Routing this one to Checkout would open a SECOND Stripe subscription
    // and bill the vendor for both.
    expect(
      hasLiveStripeSubscription(my({ is_stripe_billed: true, subscription_id: "sub_1" })),
    ).toBe(true)
  })

  it("does not quote before the plan has loaded", () => {
    expect(hasLiveStripeSubscription(undefined)).toBe(false)
    expect(hasLiveStripeSubscription(null)).toBe(false)
  })
})

describe("isPeriodExpired", () => {
  it("is true for a window that closed", () => {
    expect(isPeriodExpired(my())).toBe(true)
  })

  it("is false while the window is still running", () => {
    expect(isPeriodExpired(my({ current_period_end: "2026-10-08T00:00:00.000Z" }))).toBe(
      false,
    )
  })

  it("is false at the instant the window ends", () => {
    // Strictly past: a period ending right now is still running.
    expect(isPeriodExpired(my({ current_period_end: "2026-09-12T09:00:00.000Z" }))).toBe(
      false,
    )
  })

  it("is false with no end date", () => {
    // An admin-assigned row with no dates on it is not an expiry.
    expect(isPeriodExpired(my({ current_period_end: null }))).toBe(false)
  })

  it("is false on the free fallback", () => {
    // A FREE shop has no window at all, so a stale date on it means nothing.
    expect(isPeriodExpired(my({ is_fallback: true }))).toBe(false)
  })

  it("is false for a date it cannot read", () => {
    expect(isPeriodExpired(my({ current_period_end: "not a date" }))).toBe(false)
  })
})

describe("subscriptionState", () => {
  it("calls the production row expired", () => {
    expect(subscriptionState(my())).toBe("expired")
  })

  it("keeps a failed payment above an expired window", () => {
    // PAST_DUE is in the back-end's LIVE_SUBSCRIPTION_STATUSES, so the shop
    // still holds every capability it had — "your plan ended" would be false,
    // and the one action that fixes it is a card, not a plan.
    expect(subscriptionState(my({ status: "PAST_DUE" }))).toBe("past_due")
  })

  it("puts an expired window above a scheduled end", () => {
    // The undo the ending state offers cannot reach a window that closed.
    expect(subscriptionState(my({ cancel_at_period_end: true }))).toBe("expired")
  })

  it("puts an expired window above a running trial", () => {
    expect(
      subscriptionState(
        my({ status: "TRIALING", trial_ends_at: "2026-09-08T00:00:00.000Z" }),
      ),
    ).toBe("expired")
  })

  it("leaves a live window alone", () => {
    expect(subscriptionState(my({ current_period_end: "2026-10-08T00:00:00.000Z" }))).toBe(
      "current",
    )
    expect(subscriptionState(my({ is_fallback: true }))).toBe("free")
  })
})

describe("the clamps, which are deliberate", () => {
  it("floors the countdown at zero rather than counting backwards", () => {
    expect(daysUntil("2026-09-08T00:00:00.000Z")).toBe(0)
  })

  it("caps the bar at full", () => {
    // A full bar was never the false statement. Beside "this billing period
    // has ended" it is exactly true — the copy was the lie, not the geometry,
    // and a ratio above 1 paints the fill and the today tick outside the track.
    expect(periodProgress("2026-08-09T00:00:00.000Z", "2026-09-08T00:00:00.000Z")).toBe(1)
  })
})
