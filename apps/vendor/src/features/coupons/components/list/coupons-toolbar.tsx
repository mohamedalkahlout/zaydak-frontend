"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import { FilterBar, funnelPick, type Filter } from "@/shared/components/filter-bar"
import { DataTableViewOptions } from "@/shared/components/data-table/data-table-view-options"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import { DataTableAddFilter } from "@/shared/components/data-table/data-table-add-filter"
import type { Coupon } from "@/features/coupons/types"
import { couponFilterFields } from "@/features/coupons/lib/list/filters"

interface CouponsToolbarProps {
  table: Table<Coupon>
  search: string
  filters: Filter[]
  onSearchChange: (value: string) => void
  onFiltersChange: (filters: Filter[]) => void
  onReset: () => void
}

/** Column id → the `coupons.columns` key its header reads. */
const COLUMN_LABEL_KEYS: Record<string, string> = {
  code: "columns.code",
  type: "columns.type",
  value: "columns.value",
  minimum_cart_amount: "columns.minCart",
  scope: "columns.scope",
  status: "columns.status",
  uses: "columns.maxUses",
  expire_at: "columns.expires",
}

export function CouponsToolbar({
  table,
  search,
  filters,
  onSearchChange,
  onFiltersChange,
  onReset,
}: CouponsToolbarProps) {
  const t = useTranslations("coupons")
  const tFilterBar = useTranslations("filterBar")
  const fields = useMemo(
    () => couponFilterFields(t, { isAnyOf: tFilterBar("isAnyOf") }),
    [t, tFilterBar],
  )
  const columnLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(COLUMN_LABEL_KEYS).map(([id, key]) => [id, t(key)]),
      ),
    [t],
  )
  const hasChips = filters.length > 0
  const usedFields = new Set(filters.map((filter) => filter.field))

  return (
    <DataTableToolbar
      search={
        <DataTableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={t("toolbar.searchPlaceholder")}
        />
      }
      addFilter={
        <DataTableAddFilter
          fields={fields}
          usedFields={usedFields}
          onPickField={(fieldId) =>
            onFiltersChange(funnelPick(filters, fields, fieldId, []))
          }
          onPickValue={(fieldId, value) =>
            onFiltersChange(funnelPick(filters, fields, fieldId, [value]))
          }
        />
      }
      trailing={<DataTableViewOptions table={table} labels={columnLabels} />}
      filters={
        hasChips ? (
          <FilterBar
            fields={fields}
            value={filters}
            onChange={onFiltersChange}
            compactAdd
            className="min-w-0"
            clear={{ onClear: onReset, active: false }}
          />
        ) : null
      }
      onClear={onReset}
      isFiltered={hasChips || search !== ""}
    />
  )
}
