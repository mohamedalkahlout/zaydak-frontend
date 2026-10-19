/**
 * The plans console's routes.
 *
 * Two records, two lists, and a detail screen under each — rather than one
 * screen per record with everything folded into it. The old `/plans` carried
 * the tier list, an inline capability matrix that expanded under a row, and a
 * four-tab dialog holding every action an admin can take against a
 * subscription. All three are things you link a colleague to ("the overrides on
 * this store"), and none of them could be linked to.
 */

export const PLAN_TABS = ["overview", "capabilities", "subscribers"] as const
export type PlanTab = (typeof PLAN_TABS)[number]

export const SUBSCRIBER_TABS = ["overview", "overrides", "usage"] as const
export type SubscriberTab = (typeof SUBSCRIBER_TABS)[number]

export function planHref(planId: string, tab: PlanTab = "overview"): string {
  return tab === "overview" ? `/plans/${planId}` : `/plans/${planId}/${tab}`
}

export function subscriberHref(
  shopId: string,
  tab: SubscriberTab = "overview",
): string {
  return tab === "overview"
    ? `/subscribers/${shopId}`
    : `/subscribers/${shopId}/${tab}`
}

/**
 * Which tab a pathname is on.
 *
 * Read by position (the segment after the id) rather than by prefix, so the
 * bare detail URL does not light up every tab the way a `startsWith` check
 * would.
 */
export function tabFromPath<T extends string>(
  pathname: string,
  tabs: readonly T[],
  fallback: T,
): T {
  const segment = pathname.split("/").filter(Boolean)[2]
  return tabs.includes(segment as T) ? (segment as T) : fallback
}
