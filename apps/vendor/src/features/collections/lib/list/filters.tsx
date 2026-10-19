import type { ColumnFiltersState } from "@tanstack/react-table"
import type { useTranslations } from "next-intl"

import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"
import { toFilterOptions } from "@/shared/components/filter-bar"

import { COLLECTION_TYPE_OPTIONS, collectionTypeKey } from "./constants"

type Translate = ReturnType<typeof useTranslations<"collections">>

/**
 * The operator word, already localized. It reads the same on every list in the
 * app, so it lives under `filterBar` with the rest of the bar's chrome; this
 * module runs outside React and cannot call a hook, so the toolbar resolves it
 * and passes it down.
 */
export interface CollectionFilterOperators {
  /** The lone condition, read as "Type is Manual". */
  is: string
}

const IS = "is"

/** The one field id, which is also the table column a chip writes. */
export const COLLECTION_TYPE_FIELD = "type"

/**
 * The one thing this list filters by, and its `id` is deliberately the table
 * column it writes: `toColumnFilters` can then hand TanStack an entry without
 * a lookup table in between, and a chip keeps the same id across a round trip
 * so it is never torn down and rebuilt under the person editing it.
 *
 * `is` is the only operator, and it holds a single value. The `type` column
 * declares no `filterFn`, so TanStack resolves the automatic one — and for a
 * string accessor that is `includesString`, which stringifies whatever it is
 * given: `["MANUAL"]` reads as `MANUAL` and matches, but `["MANUAL",
 * "AUTOMATED"]` reads as the literal `MANUAL,AUTOMATED` and matches nothing at
 * all. Offering "is any of" would put a chip on screen whose second value
 * silently empties the table, so the bar offers only what the column can
 * actually answer.
 *
 * A function rather than a constant because every word on a chip comes from
 * `messages/{en,ar}.json`, and a module evaluated at import time has no locale.
 */
export function collectionFilterFields(
  t: Translate,
  operators: CollectionFilterOperators,
): FilterFieldDef[] {
  return [
    {
      id: COLLECTION_TYPE_FIELD,
      label: t("filter.type"),
      operators: [{ value: IS, label: operators.is }],
      options: toFilterOptions(COLLECTION_TYPE_OPTIONS, (value) =>
        t(collectionTypeKey(value)),
      ),
    },
  ]
}

/**
 * The `columnFilters` state the table is driven by, derived from the chips.
 *
 * It goes one way only — the chips are the state — because a chip that has been
 * added but not answered yet narrows nothing, so it is left out rather than
 * sent through as an empty array: TanStack would keep that entry in state, and
 * the list would swap to "No matching collections" before a value had even been
 * picked.
 */
export function toColumnFilters(filters: Filter[]): ColumnFiltersState {
  const byField = new Map<string, string[]>()
  for (const filter of filters) {
    if (filter.values.length === 0) continue
    // One chip per field is the model, but nothing stops a second Type chip
    // being added, and the later one is the one just edited — so it wins,
    // rather than two entries landing under the same column id where TanStack
    // reads only the first and the newer chip would look inert.
    byField.set(filter.field, [...filter.values])
  }
  return Array.from(byField, ([id, value]) => ({ id, value }))
}
