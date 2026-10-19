"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import { FilterBar, funnelPick, type Filter } from "@/shared/components/filter-bar"
import { DataTableViewOptions } from "@/shared/components/data-table/data-table-view-options"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import { DataTableAddFilter } from "@/shared/components/data-table/data-table-add-filter"
import type { ShopCollection } from "@/features/collections/types"
import { collectionFilterFields } from "@/features/collections/lib/list/filters"

interface CollectionsToolbarProps {
  table: Table<ShopCollection>
  filters: Filter[]
  onFiltersChange: (filters: Filter[]) => void
  onReset: () => void
}

export function CollectionsToolbar({
  table,
  filters,
  onFiltersChange,
  onReset,
}: CollectionsToolbarProps) {
  const t = useTranslations("collections")
  const tFilterBar = useTranslations("filterBar")
  const fields = useMemo(
    () => collectionFilterFields(t, { is: tFilterBar("is") }),
    [t, tFilterBar],
  )
  // The column menu's labels, keyed by column id.
  const columnLabels: Record<string, string> = {
    name: t("columns.name"),
    type: t("columns.type"),
    product_count: t("columns.products"),
    updated_at: t("columns.updated"),
  }
  const search = (table.getState().globalFilter ?? "") as string
  const hasChips = filters.length > 0
  const usedFields = new Set(filters.map((filter) => filter.field))

  return (
    <DataTableToolbar
      search={
        <DataTableSearch
          value={search}
          onChange={(value) => table.setGlobalFilter(value)}
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
