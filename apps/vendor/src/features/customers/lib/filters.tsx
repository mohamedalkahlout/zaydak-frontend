import type { ColumnFiltersState } from "@tanstack/react-table"
import type { useTranslations } from "next-intl"
import { CircleIcon } from "lucide-react"

import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"
import { toFilterOptions } from "@/shared/components/filter-bar"
import {
  CONTACT_STATUS_OPTIONS,
  contactStatusKey,
} from "@/features/customers/lib/constants"

type Translate = ReturnType<typeof useTranslations<"customers">>

/**
 * The operator word, already localized. It reads the same on every list in the
 * app, so it lives under `filterBar` with the rest of the bar's chrome rather
 * than in this screen's vocabulary; this module runs outside React and cannot
 * call a hook, so the toolbar resolves it and passes it down.
 */
export interface CustomerFilterOperators {
  /** The lone condition, read as "Status is Active". */
  is: string
}

const IS = "is"

/** The one field id, which is also the column id a chip writes. */
export const CUSTOMER_STATUS_FIELD = "status"

/**
 * The one field this list filters by.
 *
 * **Subscription used to sit beside it and has been removed.** The `contacts`
 * query takes `limit`, `page`, `search` and `status` and nothing else, and the
 * table is `manualFiltering`, so no client-side predicate ran either: picking
 * "Subscribed" narrowed nothing at all while the list confidently redrew. A
 * control that cannot answer is worse than a missing one, so it is gone until
 * the query takes the argument.
 *
 * `status` carries a single `is` operator, which the bar renders as plain text.
 * The query takes one `status` string, so an "is any of" would let a merchant
 * pick two statuses while only the first ever reached the server — which is
 * exactly what the multi-select faceted filter this replaced did, and the list
 * then disagreed with its own filter button.
 *
 * A function rather than a constant because every word on a chip comes from
 * `messages/{en,ar}.json`, and a module evaluated at import time has no locale.
 */
export function customerFilterFields(
  t: Translate,
  operators: CustomerFilterOperators,
): FilterFieldDef[] {
  return [
    {
      id: CUSTOMER_STATUS_FIELD,
      label: t("filter.status"),
      icon: <CircleIcon className="size-3.5" />,
      operators: [{ value: IS, label: operators.is }],
      // The same key `CustomerStatusBadge` reads, so the menu and the cell it
      // filters to cannot say two different things.
      options: toFilterOptions(CONTACT_STATUS_OPTIONS, (value) =>
        t(contactStatusKey(value)),
      ),
    },
  ]
}

/** What the list is filtered by before anyone touches the bar. */
export const INITIAL_CUSTOMER_FILTERS: ColumnFiltersState = []

/**
 * The chips a set of column filters describes — the seam through which a link
 * arriving with a status already applied would become a chip. A chip is keyed
 * by the column it writes, so a round trip through `toColumnFilters` hands the
 * bar the same ids back and no chip remounts under the merchant's cursor.
 */
export function toFilters(columnFilters: ColumnFiltersState): Filter[] {
  return columnFilters.flatMap((entry) => {
    const raw = entry.value
    const values = Array.isArray(raw)
      ? raw.filter((value): value is string => typeof value === "string")
      : typeof raw === "string" && raw !== ""
        ? [raw]
        : []
    if (values.length === 0) return []
    return [{ id: entry.id, field: entry.id, operator: IS, values }]
  })
}

/**
 * What the chips apply, in TanStack's own shape — an array of ids under the
 * column's id, byte for byte what the faceted filter used to write, so the
 * `status` variable the query reads is derived from it unchanged.
 *
 * A chip with nothing chosen yet is skipped rather than written as an empty
 * array: it narrows nothing, and an entry in `columnFilters` is what makes the
 * list count itself as filtered and show "No matching customers" instead of
 * the empty-list screen.
 *
 * Two chips on the same field are merged rather than both written, because the
 * table finds a column filter by id and would otherwise apply the first and
 * silently ignore the second.
 */
export function toColumnFilters(filters: Filter[]): ColumnFiltersState {
  return appliedValues(filters).map(([id, value]) => ({ id, value }))
}

/**
 * The merge itself, before TanStack's `ColumnFilter` erases the value type to
 * `unknown`. `filterQueryKey` reads this rather than the array it hands the
 * table so that comparing two queries needs no cast back to `string[]`.
 */
function appliedValues(filters: Filter[]): [string, string[]][] {
  const byColumn = new Map<string, string[]>()
  for (const filter of filters) {
    if (filter.values.length === 0) continue
    const values = byColumn.get(filter.field) ?? []
    for (const value of filter.values) {
      if (!values.includes(value)) values.push(value)
    }
    byColumn.set(filter.field, values)
  }
  return [...byColumn]
}

/**
 * A comparable summary of what `toColumnFilters` would apply. The page resets
 * when this changes rather than on every edit to the bar, which is what the
 * old column-filter handler amounted to: adding a chip that has no value yet
 * narrows nothing, and sending a merchant back to page one for it would be a
 * reset with nothing behind it.
 */
export function filterQueryKey(filters: Filter[]): string {
  return appliedValues(filters)
    .map(([id, values]) => `${id}:${values.join(",")}`)
    .sort()
    .join("|")
}
