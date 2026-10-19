import { SubscriptionStatus } from "@/shared/api/generated/graphql"
import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"

/**
 * What the subscriber list filters by, and how a chip on the filter bar becomes
 * `shopSubscriptions` arguments.
 *
 * The mapping lives here rather than in the table because it is the half that
 * has to stay exact: the bar owns which chips exist, but the server still only
 * understands `statuses` and `plan_id`, and the status presets below are not
 * one status each.
 */

/** The statuses that mean the shop is on the plan right now. */
export const LIVE_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Trialing,
  SubscriptionStatus.PastDue,
]

/**
 * How the status filter is presented.
 *
 * "Live" is the default and is three statuses, not one: dunning is still a
 * subscriber — Stripe is still retrying the card and the shop still has its
 * plan. Treating `past_due` as lapsed would hide exactly the shops an admin
 * most needs to see.
 *
 * `all` is the one key that is never offered as a chip value: on the bar,
 * "every status" is what removing the chip says, so it is the value an absent
 * or half-built chip resolves to rather than something to pick.
 */
export const STATUS_FILTERS: Record<string, SubscriptionStatus[] | undefined> = {
  live: LIVE_STATUSES,
  active: [SubscriptionStatus.Active],
  trialing: [SubscriptionStatus.Trialing],
  past_due: [SubscriptionStatus.PastDue],
  canceled: [SubscriptionStatus.Canceled],
  expired: [SubscriptionStatus.Expired],
  all: undefined,
}

export type StatusFilter = keyof typeof STATUS_FILTERS

/** The presets a chip may hold, in the order the old select listed them. */
export const STATUS_OPTIONS = [
  "live",
  "active",
  "trialing",
  "past_due",
  "canceled",
  "expired",
] as const

/** The status the list opens on, as it always has. */
export const DEFAULT_STATUS = "live"

/**
 * Field ids are the query arguments they produce, so there is nothing to
 * translate between a chip and `useQuery`'s variables.
 */
export const STATUS_FIELD = "statuses"
export const PLAN_FIELD = "plan_id"

/**
 * Both fields hold one value, so both carry a single operator — which the bar
 * draws as plain text rather than a menu.
 */
const IS = "is"

export interface SubscriberFilterLabels {
  /** The status field's name. */
  status: string
  /** The plan field's name. */
  plan: string
  /** The lone operator, read as "Status is Live". */
  is: string
  /** One status preset, by its `STATUS_FILTERS` key. */
  statusOption: (key: string) => string
}

/** The subset of a plan row the picker needs. */
export interface PlanOption {
  id: string
  name: string
}

export function subscriberFilterFields({
  labels,
  plans,
}: {
  labels: SubscriberFilterLabels
  /**
   * `null` inside a plan's own screen: filtering by plan there is a control
   * that navigates away from the record being viewed, so the field is not
   * offered at all rather than offered and ignored.
   */
  plans: readonly PlanOption[] | null
}): FilterFieldDef[] {
  const fields: FilterFieldDef[] = [
    {
      id: STATUS_FIELD,
      label: labels.status,
      operators: [{ value: IS, label: labels.is }],
      options: STATUS_OPTIONS.map((key) => ({
        value: key,
        label: labels.statusOption(key),
      })),
    },
  ]

  if (plans) {
    fields.push({
      id: PLAN_FIELD,
      label: labels.plan,
      operators: [{ value: IS, label: labels.is }],
      options: plans.map((plan) => ({ value: plan.id, label: plan.name })),
    })
  }

  return fields
}

/** The arguments `shopSubscriptions` is asked for. */
export interface SubscriberQuery {
  statuses: SubscriptionStatus[] | undefined
  plan_id: string | undefined
}

/**
 * The applied chips as query arguments.
 *
 * A chip with no value yet narrows nothing and is skipped — the bar opens the
 * value menu the moment a filter is added, and sending `statuses: []` for the
 * second between adding and picking would empty the table under the open menu.
 */
export function toQuery(filters: Filter[]): SubscriberQuery {
  const valueOf = (field: string) =>
    filters.find((f) => f.field === field && f.values.length > 0)?.values[0]

  return {
    statuses: STATUS_FILTERS[valueOf(STATUS_FIELD) ?? "all"],
    plan_id: valueOf(PLAN_FIELD),
  }
}

/**
 * The chips for a starting state.
 *
 * Each chip's id is its field id, so seeding and reading back cannot remount a
 * chip that never changed.
 */
export function toFilters(state: {
  status?: string
  plan_id?: string
}): Filter[] {
  const filters: Filter[] = []

  if (state.status) {
    filters.push({
      id: STATUS_FIELD,
      field: STATUS_FIELD,
      operator: IS,
      values: [state.status],
    })
  }

  if (state.plan_id) {
    filters.push({
      id: PLAN_FIELD,
      field: PLAN_FIELD,
      operator: IS,
      values: [state.plan_id],
    })
  }

  return filters
}
