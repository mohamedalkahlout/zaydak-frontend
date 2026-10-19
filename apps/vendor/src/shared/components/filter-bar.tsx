"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"

import {
  FilterBar as SharedFilterBar,
  type Filter,
  type FilterBarProps,
  type FilterFieldDef,
  type FilterOption,
} from "@repo/ui/components/filter-bar"

export type {
  Filter,
  FilterBarClear,
  FilterFieldDef,
  FilterOperatorDef,
  FilterOption,
} from "@repo/ui/components/filter-bar"

let filterSequence = 0
const filterUid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `filter-${(filterSequence += 1)}`

/**
 * Add or replace one chip by field id. One chip per field is the bar's model;
 * a funnel pick that names a field already on the bar overwrites it rather
 * than stacking a second chip the query would ignore.
 */
export function upsertFilter(
  filters: Filter[],
  field: string,
  values: string[],
  operator: string,
): Filter[] {
  const existing = filters.find((filter) => filter.field === field)
  if (existing) {
    return filters.map((filter) =>
      filter.field === field ? { ...filter, values, operator } : filter,
    )
  }
  return [...filters, { id: filterUid(), field, operator, values }]
}

export function funnelPick(
  filters: Filter[],
  fields: FilterFieldDef[],
  fieldId: string,
  values: string[],
): Filter[] {
  const operator =
    fields.find((field) => field.id === fieldId)?.operators[0]?.value ?? "is"
  return upsertFilter(filters, fieldId, values, operator)
}

/**
 * One value a list filters by, as a feature's constants hold it: the id the API
 * speaks and the glyph the chip draws it with — and deliberately no label.
 *
 * A label here would be a second copy of the one the badge rendering the same
 * id already has, which is how the orders list ended up offering "COD" on its
 * filter menu beside "Cash on delivery" on the order it filtered to. What a
 * value reads as is a message key derived from the value, resolved wherever
 * `useTranslations` can be reached.
 */
export interface FilterValueOption<TValue extends string = string> {
  value: TValue
  icon?: LucideIcon
}

/**
 * A feature's value constants as the bar wants them, with every label resolved
 * through the caller's own `t`. One helper rather than one per list, because
 * the four screens were each carrying the same six lines.
 */
export function toFilterOptions<TValue extends string>(
  options: readonly FilterValueOption<TValue>[],
  label: (value: TValue) => string,
): FilterOption[] {
  return options.map(({ value, icon: Icon }) => ({
    value,
    label: label(value),
    glyph: Icon ? (
      <Icon className="size-3.5 text-muted-foreground" />
    ) : undefined,
  }))
}

/**
 * The shared segmented filter bar with this app's translations already in it.
 *
 * `@repo/ui` reads no `next-intl` — every string it draws arrives as a prop —
 * so one wrapper per app is what keeps the nine pieces of chrome (the add
 * button, the empty-value placeholder, the menu's search box, the async and
 * error rows) and the four accessible names from being re-translated on every
 * list that renders a bar.
 *
 * A screen passes only what is its own: the fields it filters by, the applied
 * filters, and where they go on change. `compactAdd` defaults on so the add
 * control is a quiet plus rather than a labelled dashed button; pass
 * `compactAdd={false}` to get the old empty-bar label back.
 */
export function FilterBar({
  "aria-label": ariaLabel,
  compactAdd = true,
  ...props
}: Omit<FilterBarProps, "labels">) {
  const t = useTranslations("filterBar")

  const labels = useMemo(
    () => ({
      add: t("add"),
      empty: t("empty"),
      selectValue: t("selectValue"),
      search: t("search"),
      noMatches: t("noMatches"),
      loading: t("loading"),
      loadError: t("loadError"),
      retry: t("retry"),
      clear: t("clear"),
      editField: (field: string) => t("editField", { field }),
      editOperator: (field: string) => t("editOperator", { field }),
      editValue: (field: string, value: string) =>
        t("editValue", { field, value }),
      remove: (field: string) => t("remove", { field }),
    }),
    [t],
  )

  return (
    <SharedFilterBar
      {...props}
      compactAdd={compactAdd}
      labels={labels}
      aria-label={ariaLabel ?? t("label")}
    />
  )
}
