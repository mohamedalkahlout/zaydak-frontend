import type { MyPlanEntry } from "../types"

/**
 * What the subscription needs the vendor to know, as one word.
 *
 * The screens ask this rather than re-deriving it from four nullable fields
 * each — which is how the sidebar came to claim a three-day trial for stores
 * that had none. One function, one answer, every surface agrees.
 *
 * Order matters. A failed payment outranks everything: the store is working,
 * nothing else on screen looks wrong, and it is days from being cut off. A
 * scheduled end outranks a running trial, because it is the more recent
 * decision and the one that can still be undone. An expired window outranks a
 * scheduled end and a running trial because both of those describe something
 * still ahead: offering an undo, or a countdown, for a window that closed four
 * days ago is the defect this member exists to remove. It sits *below*
 * `past_due` because a retrying card still grants every capability — the shop
 * has not lapsed, and "your plan ended" would be false while the one action
 * that fixes it is a card, not a plan.
 */
export type SubscriptionState =
  | "past_due"
  | "expired"
  | "ending"
  | "trialing"
  | "free"
  | "current"

/**
 * The window closed and nothing moved it.
 *
 * Strictly in the past, so a period ending this instant is still running. The
 * fallback is excluded rather than clamped: a FREE shop has no window at all,
 * and a missing `current_period_end` is not an expiry, it is an admin-assigned
 * row with no dates on it.
 */
export function isPeriodExpired(my: MyPlanEntry): boolean {
  if (my.is_fallback || !my.current_period_end) return false
  const end = new Date(my.current_period_end).getTime()
  return Number.isFinite(end) && end < Date.now()
}

export function subscriptionState(my: MyPlanEntry): SubscriptionState {
  if (my.status === "PAST_DUE") return "past_due"
  if (isPeriodExpired(my)) return "expired"
  if (my.cancel_at_period_end) return "ending"
  if (my.status === "TRIALING") return "trialing"
  if (my.is_fallback) return "free"
  return "current"
}

/**
 * Whether a plan change can be charged in place rather than bought.
 *
 * A shop only has a card on file when Stripe opened the subscription. An
 * admin-assigned row satisfies every *other* test — it is not the fallback and
 * it carries a `subscription_id` — but there is nothing at Stripe to prorate,
 * so quoting it ends at `no_live_subscription` and the vendor can never
 * subscribe. `subscription_id` is deliberately not re-checked here: the server
 * derives `is_stripe_billed` from the same live row, so it cannot be true
 * without one, and testing both invites the reading that they can disagree.
 */
export function hasLiveStripeSubscription(my?: MyPlanEntry | null): boolean {
  return Boolean(my && !my.is_fallback && my.is_stripe_billed)
}

/**
 * Whole days from now until `iso`, rounded **up**, never below zero.
 *
 * Up, because a trial with eighteen hours left is on its last day and must not
 * read as "0 days" while it is still running. Clamped, because a window that
 * has closed but whose webhook has not landed yet should say "today", not
 * "-1 days".
 */
export function daysUntil(iso?: string | null): number {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * How far through the period we are, 0–1.
 *
 * Returns null when the window is unusable — a missing or inverted pair would
 * otherwise render a bar at a nonsense width rather than not rendering.
 */
export function periodProgress(
  startIso?: string | null,
  endIso?: string | null,
): number | null {
  if (!startIso || !endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!(end > start)) return null
  const ratio = (Date.now() - start) / (end - start)
  return Math.min(1, Math.max(0, ratio))
}
