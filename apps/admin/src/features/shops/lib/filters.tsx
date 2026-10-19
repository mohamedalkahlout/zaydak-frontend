import type { useTranslations } from "next-intl"
import { CircleDotIcon } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { ShopStatusFilter } from "@/shared/api/generated/graphql"
import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"

import { SHOP_STATUSES } from "../types"

/**
 * What the filter bar offers, and the `shops` variables behind it.
 *
 * The mapping lives here rather than in the screen because it is the half
 * worth testing on its own: the bar deals in chips that may be half-finished,
 * while the query takes a single optional `ShopStatusFilter`, and the two have
 * to agree about what "no filter" means.
 */

/**
 * The field id, which is deliberately the same string as the query key it maps
 * to. A chip that comes back out of `toFilters` under a different id would be
 * a new chip to the bar, and it would remount mid-edit.
 */
export const SHOP_STATUS_FIELD = "status"

/**
 * The only condition the server offers. `shops` takes one `ShopStatusFilter`,
 * not a list, so there is no "is any of" to give this field — and a field with
 * a single operator renders it as plain text rather than as a menu whose only
 * entry is already chosen.
 */
const IS = "is"

/**
 * The operator word, already localized by the caller.
 *
 * The condition reads the same on every list in the console, so it lives under
 * the shared `filterBar` namespace rather than under `shops` — and this module
 * sits outside React, so the screen resolves it and hands it in.
 */
export interface ShopFilterOperators {
  /** The lone condition, read as "Status is Suspended". */
  is: string
}

/** The slice of the `shops` variables the bar owns. `search` is not its. */
export interface ShopListFilters {
  status?: ShopStatusFilter
}

/**
 * Chip values are plain strings — one can outlive the option that produced it,
 * and the bar renders an unknown value as its raw id rather than dropping it —
 * so the enum is looked up rather than asserted on the way to the query.
 */
const STATUS_BY_VALUE = new Map<string, ShopStatusFilter>(
  SHOP_STATUSES.map((status) => [status, status]),
)

/**
 * A dot per status, in the same reading as `statusBadgeVariant`: live is
 * green, the two reversible states are quiet, and the archive is red.
 */
const STATUS_DOT: Record<(typeof SHOP_STATUSES)[number], string> = {
  [ShopStatusFilter.Active]: "bg-emerald-500",
  [ShopStatusFilter.Pending]: "bg-amber-500",
  [ShopStatusFilter.Suspended]: "bg-muted-foreground/50",
  [ShopStatusFilter.Deleted]: "bg-rose-500",
}

function StatusDot({ status }: { status: (typeof SHOP_STATUSES)[number] }) {
  return (
    <span
      aria-hidden
      className={cn("flex size-2 shrink-0 rounded-full", STATUS_DOT[status])}
    />
  )
}

type Translate = ReturnType<typeof useTranslations<"shops">>

/**
 * One field, because the list query takes one filter beyond the free-text
 * search — and `SHOP_STATUSES` is reused rather than retyped so the bar cannot
 * drift from the four values the resolver accepts.
 *
 * There is no "all" entry: the console's unfiltered view is *omitting*
 * `status`, which the bar already expresses by having no chip on it. An `all`
 * option would drag deleted shops into what reads as the default view.
 */
export function shopFilterFields(
  t: Translate,
  operators: ShopFilterOperators,
): FilterFieldDef[] {
  return [
    {
      id: SHOP_STATUS_FIELD,
      label: t("column.status"),
      icon: <CircleDotIcon className="size-3.5" />,
      // The operator comes in already localized; every other string here is
      // the one the table already shows, so the chip and the Status column can
      // never disagree.
      operators: [{ value: IS, label: operators.is }],
      options: SHOP_STATUSES.map((status) => ({
        value: status,
        label: t(`status.${status}`),
        glyph: <StatusDot status={status} />,
      })),
    },
  ]
}

/**
 * The chips as the server reads them.
 *
 * A chip that has just been added carries no value yet, and that is the point
 * of keeping `Filter[]` as the source of truth: here it simply narrows
 * nothing, which is the same query as an empty bar.
 */
export function toQuery(filters: Filter[]): ShopListFilters {
  const chip = filters.find((filter) => filter.field === SHOP_STATUS_FIELD)
  return { status: STATUS_BY_VALUE.get(chip?.values[0] ?? "") }
}

/** The other direction, for seeding the bar from a query it did not build. */
export function toFilters(query: ShopListFilters): Filter[] {
  if (!query.status) return []
  return [
    {
      id: SHOP_STATUS_FIELD,
      field: SHOP_STATUS_FIELD,
      operator: IS,
      values: [query.status],
    },
  ]
}
