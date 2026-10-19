/**
 * The plan screen's URLs, in one place.
 *
 * It is a top-level route rather than a settings page because it does not use
 * the dashboard chrome: choosing a plan is a decision the whole viewport
 * should be given to, and the sidebar is a list of everything the vendor is
 * not doing right now.
 *
 * The back-end builds `planUrl` for Stripe's return URL
 * (`BillingService.startCheckout`). If that changes, this changes.
 */

/**
 * The four questions a vendor arrives with, as four routes.
 *
 * They were one page. That page answered "what am I on", "what could I move
 * to", "what have I used" and "what have I paid" in a single 600-line scroll,
 * so the answer to any one of them was somewhere below the answer to another —
 * and the one a vendor arrives from a quota wall for, usage, was fifth of six
 * sections. Splitting them makes each answer linkable, which is the part that
 * matters: "your usage page" is something support can send.
 *
 * `overview` has no segment of its own — it is the plan screen's front door,
 * and `/plan/acme/overview` beside `/plan/acme` would be two URLs for it.
 */
export const PLAN_TABS = ["overview", "plans", "usage", "billing"] as const

export type PlanTab = (typeof PLAN_TABS)[number]

/** The overview, and the URL Stripe returns to. */
export function planUrl(shopSlug: string): string {
  return `/plan/${shopSlug}`
}

export function planTabUrl(shopSlug: string, tab: PlanTab): string {
  return tab === "overview" ? planUrl(shopSlug) : `/plan/${shopSlug}/${tab}`
}

/**
 * Which tab a pathname is on.
 *
 * Matched on the segment after the slug rather than by prefix, so `/plan/acme`
 * does not light up every tab at once the way a `startsWith` check would.
 */
export function planTabFromPath(pathname: string): PlanTab {
  const segment = pathname.split("/").filter(Boolean)[2]
  return PLAN_TABS.includes(segment as PlanTab)
    ? (segment as PlanTab)
    : "overview"
}
