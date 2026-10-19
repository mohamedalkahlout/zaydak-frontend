import type { useTranslations } from "next-intl"
import { CircleDotIcon, LayersIcon, TagIcon } from "lucide-react"

import type {
  Filter,
  FilterFieldDef,
  FilterOperatorDef,
} from "@/shared/components/filter-bar"
import { toFilterOptions } from "@/shared/components/filter-bar"
import type { CouponType } from "@/features/coupons/types"
import {
  COUPON_SCOPE_OPTIONS,
  COUPON_STATUS_OPTIONS,
  COUPON_TYPE_OPTIONS,
  couponScopeKey,
  couponStatusKey,
  couponTypeKey,
} from "./constants"
import {
  COUPON_SCOPE_FILTER_VALUES,
  COUPON_STATUS_FILTER_VALUES,
  COUPON_TYPE_FILTER_VALUES,
  type CouponListQueryState,
  type CouponScopeFilter,
  type CouponStatusFilter,
} from "./query-state"

/**
 * The three faceted filters the coupons list used to draw as separate dropdowns,
 * expressed as fields for the shared filter bar.
 *
 * A field's `id` is deliberately the query-state key it writes (`statuses`,
 * not `status`), so `toCouponFilterQuery` needs no lookup table between the two
 * and a chip round-tripped through the URL keeps its React identity instead of
 * remounting.
 */
export type CouponFilterFieldId = "statuses" | "types" | "scopes"

/** The slice of the list's query state these chips own. */
export type CouponFilterQuery = Pick<
  CouponListQueryState,
  "statuses" | "types" | "scopes"
>

const FIELD_IDS: CouponFilterFieldId[] = ["statuses", "types", "scopes"]

type Translate = ReturnType<typeof useTranslations<"coupons">>

/**
 * The operator word, already localized. It reads the same on every list in the
 * app, so it lives under `filterBar` with the rest of the bar's chrome; this
 * module runs outside React and cannot call a hook, so the toolbar resolves it
 * and passes it down.
 */
export interface CouponFilterOperators {
  /** The lone condition, read as "Status is any of Active, Expired". */
  isAnyOf: string
}

/**
 * Every field holds several values at once, which is what the three dropdowns
 * did. A field with one operator renders it as plain text, so the chip reads
 * "Status is any of Active, Expired" with nothing extra to click past.
 */
export const COUPON_FILTER_OPERATOR = "in"

/**
 * The fields as the bar draws them. A function rather than a constant because
 * every word on a chip — the field, the condition and each value — comes out of
 * `messages/{en,ar}.json`, and a module evaluated at import time has no locale.
 *
 * The value labels resolve the same keys the list's badges read, so the menu
 * and the row it filters to cannot say two different things; types in
 * particular go through the create dialog's own `kinds.<type>.label` rather
 * than a fourth spelling of the same four names.
 */
export function couponFilterFields(
  t: Translate,
  operators: CouponFilterOperators,
): FilterFieldDef[] {
  const isAnyOf: FilterOperatorDef[] = [
    { value: COUPON_FILTER_OPERATOR, label: operators.isAnyOf, multi: true },
  ]

  return [
    {
      id: "statuses",
      label: t("filter.statuses"),
      icon: <CircleDotIcon className="size-3.5" />,
      operators: isAnyOf,
      options: toFilterOptions(COUPON_STATUS_OPTIONS, (value) =>
        t(couponStatusKey(value)),
      ),
    },
    {
      id: "types",
      label: t("filter.types"),
      icon: <TagIcon className="size-3.5" />,
      operators: isAnyOf,
      options: toFilterOptions(COUPON_TYPE_OPTIONS, (value) =>
        t(couponTypeKey(value)),
      ),
    },
    {
      id: "scopes",
      label: t("filter.scopes"),
      icon: <LayersIcon className="size-3.5" />,
      operators: isAnyOf,
      options: toFilterOptions(COUPON_SCOPE_OPTIONS, (value) =>
        t(couponScopeKey(value)),
      ),
    },
  ]
}

/**
 * Values from every chip on one field, validated against the same lists the URL
 * parser accepts. The bar allows a second chip on a field a person has already
 * filtered by, so the values are unioned rather than the last chip winning —
 * two "Status" chips mean the same thing as one holding both values.
 */
function collect<T extends string>(
  filters: Filter[],
  id: CouponFilterFieldId,
  allowed: readonly T[],
): T[] | undefined {
  const valid = new Set<string>(allowed)
  const picked = filters
    .filter((filter) => filter.field === id)
    .flatMap((filter) => filter.values)
    .filter((value): value is T => valid.has(value))

  if (picked.length === 0) return undefined
  return Array.from(new Set(picked))
}

/**
 * Chips to query state. Every key is always present — `updateQuery` decides
 * what to write with `key in patch`, so an omitted key would leave the previous
 * value in the URL and removing the last chip of a field would never clear it.
 */
export function toCouponFilterQuery(filters: Filter[]): CouponFilterQuery {
  return {
    statuses: collect<CouponStatusFilter>(
      filters,
      "statuses",
      COUPON_STATUS_FILTER_VALUES,
    ),
    types: collect<CouponType>(filters, "types", COUPON_TYPE_FILTER_VALUES),
    scopes: collect<CouponScopeFilter>(
      filters,
      "scopes",
      COUPON_SCOPE_FILTER_VALUES,
    ),
  }
}

/** Query state to chips — one chip per field, in the order the fields are listed. */
export function toCouponFilters(query: CouponFilterQuery): Filter[] {
  return FIELD_IDS.flatMap<Filter>((id) => {
    const values = query[id]
    if (!values || values.length === 0) return []
    return [
      { id, field: id, operator: COUPON_FILTER_OPERATOR, values: [...values] },
    ]
  })
}

/**
 * What the URL says about the filters, as one comparable string. The screen
 * holds the chips in state — a chip that has just been added has no values yet
 * and deriving them from the URL would drop it before it could be filled in —
 * so this is how it tells its own pending write apart from a URL that changed
 * underneath it (the back button, or the Reset that also clears the search).
 */
export function couponFilterSignature(query: CouponFilterQuery): string {
  return FIELD_IDS.map((id) => `${id}:${(query[id] ?? []).join(",")}`).join("|")
}

export const EMPTY_COUPON_FILTER_SIGNATURE = couponFilterSignature({})
