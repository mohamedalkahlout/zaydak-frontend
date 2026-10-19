import type { WithdrawalStatus } from "@/shared/api/generated/graphql"
import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"

import { WITHDRAWAL_STATUSES } from "../status"

/**
 * The filter bar's half of the withdrawals list.
 *
 * `withdrawals` narrows by one optional `status` argument and nothing else, so
 * the screen has exactly one field and the whole query is derived from the
 * chips. No chip, a chip with no value yet, and a value the enum no longer has
 * all mean "every request" — which is what the old `All statuses` option sent.
 */

/**
 * The field id doubles as the key it maps to in the query and as the id
 * `toFilters` gives the chip, so a query that round-trips through the bar
 * lands on the same chip rather than remounting a new one.
 */
export const STATUS_FIELD = "status"

/**
 * The only operator's value. A field with one operator is drawn as plain text
 * rather than a menu, so this is the middle word of "Status is Pending" and not
 * a control — and a second operator would have to mean something the server can
 * express, which `status` alone cannot. Its label is not here: the condition
 * reads the same on every list, so it comes from the shared `filterBar`
 * namespace, resolved by the screen because this module cannot call a hook.
 */
const IS = "is"

export interface WithdrawalFilterLabels {
  /** The field's own name — the same word the Status column is headed with. */
  field: string
  /** The lone operator, already localized. */
  is: string
  /** One status, already localized. */
  status: (status: WithdrawalStatus) => string
}

/**
 * What the list is narrowed by. `status: undefined` is every status rather than
 * none, which is why it is spelled as an absent key and not as a sentinel: it
 * is the argument the query omits.
 */
export interface WithdrawalQuery {
  status?: WithdrawalStatus
}

/** The fields the bar offers, built from strings the caller has localized. */
export function withdrawalFilterFields(
  labels: WithdrawalFilterLabels,
): FilterFieldDef[] {
  return [
    {
      id: STATUS_FIELD,
      label: labels.field,
      operators: [{ value: IS, label: labels.is }],
      options: WITHDRAWAL_STATUSES.map((status) => ({
        value: status,
        label: labels.status(status),
      })),
    },
  ]
}

/**
 * The bar holds values as raw strings and deliberately renders one it cannot
 * name instead of dropping it, so a value that is not a status has to be
 * refused here — sent on, it would fail the whole query on the enum rather than
 * narrowing nothing.
 */
const isWithdrawalStatus = (value: string): value is WithdrawalStatus =>
  (WITHDRAWAL_STATUSES as readonly string[]).includes(value)

/** The GraphQL variables the applied chips add up to. */
export function toQuery(filters: Filter[]): WithdrawalQuery {
  const value = filters.find((f) => f.field === STATUS_FIELD)?.values[0]
  return {
    status: value !== undefined && isWithdrawalStatus(value) ? value : undefined,
  }
}

/** The inverse: the chips a query already narrowed by a status is wearing. */
export function toFilters(query: WithdrawalQuery): Filter[] {
  if (!query.status) return []
  return [
    {
      id: STATUS_FIELD,
      field: STATUS_FIELD,
      operator: IS,
      values: [query.status],
    },
  ]
}
