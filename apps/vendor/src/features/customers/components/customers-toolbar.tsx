"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import { DataTableViewOptions } from "@/shared/components/data-table/data-table-view-options"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import { DataTableAddFilter } from "@/shared/components/data-table/data-table-add-filter"
import {
  FilterBar,
  funnelPick,
  type Filter,
} from "@/shared/components/filter-bar"
import type { Contact } from "@/features/customers/types"
import { customerFilterFields } from "@/features/customers/lib/filters"

interface CustomersToolbarProps {
  table: Table<Contact>
  filters: Filter[]
  onFiltersChange: (filters: Filter[]) => void
  onReset: () => void
}

export function CustomersToolbar({
  table,
  filters,
  onFiltersChange,
  onReset,
}: CustomersToolbarProps) {
  const t = useTranslations("customers")
  const tFilterBar = useTranslations("filterBar")
  const fields = useMemo(
    () => customerFilterFields(t, { is: tFilterBar("is") }),
    [t, tFilterBar],
  )
  // The display menu's names for the hideable columns, from the same keys the
  // column headers read.
  const columnLabels = useMemo<Record<string, string>>(
    () => ({
      name: t("columns.name"),
      subscription: t("columns.subscription"),
      location: t("columns.location"),
      status: t("columns.status"),
      score: t("columns.score"),
      tags: t("columns.tags"),
      created_at: t("columns.added"),
    }),
    [t],
  )
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
