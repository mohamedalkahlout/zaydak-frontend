"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"

import {
  FilterBar as SharedFilterBar,
  type FilterBarProps,
} from "@repo/ui/components/filter-bar"

export type {
  Filter,
  FilterFieldDef,
  FilterOperatorDef,
  FilterOption,
} from "@repo/ui/components/filter-bar"

/**
 * The shared segmented filter bar with this console's translations already in
 * it.
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
