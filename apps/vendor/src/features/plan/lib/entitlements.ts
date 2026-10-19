import type { EntitlementEntry, UsageEntry } from "../types"

/**
 * The shop's plan, as the UI reasons about it.
 *
 * Every gate in the app reads from one resolved map. `myEntitlements` already
 * applies override-over-plan precedence server-side, so nothing here
 * re-implements it — a second copy of that rule is a second place for it to be
 * wrong.
 */

/**
 * What is left of a metered allowance.
 *
 * **Null means unlimited, `0` means none left** — the distinction the AI Studio
 * already encodes and the one a UI gets wrong first. A caller that treats null
 * as zero hides a feature the shop actually has unlimited access to; one that
 * treats zero as null offers a button that will be refused.
 *
 * Clamped at zero: a shop can end up over its ceiling after a downgrade, and a
 * negative would render as text.
 */
export function remaining(
  limit: number | null | undefined,
  used: number,
): number | null {
  if (limit === null || limit === undefined) return null
  return Math.max(0, limit - used)
}

/** Percent of the allowance consumed, or null when unlimited. */
export function percentUsed(
  limit: number | null | undefined,
  used: number,
): number | null {
  if (limit === null || limit === undefined) return null
  // A ZERO ceiling is a real ceiling the shop is already past — returning null
  // here would read as "unlimited" to any caller using the null convention.
  if (limit === 0) return used > 0 ? 100 : 0
  return Math.min(100, Math.round((used / limit) * 1000) / 10)
}

export interface FeatureState {
  /** False when the plan excludes it, or when there is no entitlement at all. */
  allowed: boolean
  limit: number | null
  used: number
  /** Null when unlimited. */
  remaining: number | null
  percent: number | null
  /** True when the allowance is spent — the state an upgrade prompt reacts to. */
  exhausted: boolean
  config: Record<string, unknown>
  unit: string
  period: string
  /** When the current allowance resets. Absent for LIMIT/BOOLEAN. */
  resetsAt: string | null
}

const DENIED: FeatureState = {
  allowed: false,
  limit: null,
  used: 0,
  remaining: null,
  percent: null,
  exhausted: false,
  config: {},
  unit: "none",
  period: "NONE",
  resetsAt: null,
}

/**
 * Fold the entitlement and its usage into one answer for a capability.
 *
 * A capability **absent from the map is denied**, not unlimited — a missing
 * entitlement row denies server-side, and the UI has to agree or it will offer
 * buttons the server refuses.
 */
export function featureState(
  key: string,
  entitlements: EntitlementEntry[] | undefined,
  usage: UsageEntry[] | undefined,
): FeatureState {
  const entitlement = entitlements?.find((e) => e.key === key)
  if (!entitlement || !entitlement.enabled) return DENIED

  const consumption = usage?.find((u) => u.key === key)
  const used = consumption?.used ?? 0
  const limit = entitlement.limit_value ?? null
  const left = remaining(limit, used)

  return {
    allowed: true,
    limit,
    used,
    remaining: left,
    percent: percentUsed(limit, used),
    exhausted: left === 0,
    config: entitlement.config ?? {},
    unit: entitlement.billing_unit,
    period: entitlement.period,
    resetsAt: consumption?.period_end ?? null,
  }
}

/** Group the resolved map the way the pricing table groups it. */
export function byGroup(
  entitlements: EntitlementEntry[],
): Array<[string, EntitlementEntry[]]> {
  const map = new Map<string, EntitlementEntry[]>()
  for (const e of entitlements) {
    const list = map.get(e.group) ?? []
    list.push(e)
    map.set(e.group, list)
  }
  return [...map.entries()]
}
