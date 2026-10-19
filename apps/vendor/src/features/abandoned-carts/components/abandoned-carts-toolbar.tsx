"use client"

import { useCallback, useMemo } from "react"
import { useApolloClient } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import {
  FilterBar,
  type Filter,
  type FilterOption,
} from "@/shared/components/filter-bar"
import { GET_CONTACTS } from "@/features/customers/api"
import {
  abandonedCartFilterFields,
  upsertAbandonedCartFilter,
  type AbandonedCartStatusCounts,
} from "@/features/abandoned-carts/lib/filters"
import type {
  AbandonedCartSortDir,
  AbandonedCartSortField,
  AbandonedCartsView,
} from "@/features/abandoned-carts/types"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import { DataTableAddFilter } from "@/shared/components/data-table/data-table-add-filter"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"
import { AbandonedCartsViewOptions } from "./abandoned-carts-view-options"

export function AbandonedCartsToolbar<TData>({
  search,
  filters,
  onSearchChange,
  onFiltersChange,
  onReset,
  view,
  onViewChange,
  table,
  sortBy,
  sortDir,
  onSortChange,
  columnLabels,
  onExport,
  onExportOps,
  exportOpsBusy,
  resultCount,
  statusCounts,
}: {
  search: string
  filters: Filter[]
  onSearchChange: (value: string) => void
  onFiltersChange: (filters: Filter[]) => void
  onReset: () => void
  view: AbandonedCartsView
  onViewChange: (view: AbandonedCartsView) => void
  table: Table<TData>
  sortBy: AbandonedCartSortField
  sortDir: AbandonedCartSortDir
  onSortChange: (
    sortBy: AbandonedCartSortField,
    sortDir: AbandonedCartSortDir,
  ) => void
  columnLabels: Record<string, string>
  onExport: () => void
  /** Downloads the send / hide activity log for the current date range. */
  onExportOps?: () => void
  exportOpsBusy?: boolean
  resultCount?: number
  /** From `abandonedCartStatusCounts`; drawn beside each status option. */
  statusCounts?: AbandonedCartStatusCounts
}) {
  const t = useTranslations("abandonedCarts")
  const tFilterBar = useTranslations("filterBar")
  const client = useApolloClient()
  const loadCustomers = useCallback(
    async (query: string): Promise<FilterOption[]> => {
      const result = await client.query({
        query: GET_CONTACTS,
        variables: {
          page: 1,
          limit: 20,
          search: query.trim() || undefined,
        },
        fetchPolicy: "network-only",
      })
      const rows =
        (
          result.data as {
            contacts?: { data?: Array<{ id: string; name: string }> }
          } | null
        )?.contacts?.data ?? []
      return rows.map((row) => ({
        value: row.name,
        label: row.name,
      }))
    },
    [client],
  )
  const fields = useMemo(
    () =>
      abandonedCartFilterFields(
        t,
        tFilterBar("is"),
        loadCustomers,
        statusCounts,
      ),
    [t, tFilterBar, loadCustomers, statusCounts],
  )
  const usedFields = new Set(filters.map((filter) => filter.field))
  const hasChips = filters.length > 0

  return (
    <DataTableToolbar
      leading={
        <>
          <DataTableViewTabs aria-label={t("chrome.views")}>
            {(["customer", "product"] as const).map((id) => (
              <DataTableViewTab
                key={id}
                selected={view === id}
                onClick={() => onViewChange(id)}
              >
                {t(`view.${id}`)}
              </DataTableViewTab>
            ))}
          </DataTableViewTabs>
          {resultCount != null ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {view === "product"
                ? t("productCount", { count: resultCount })
                : t("openCount", { count: resultCount })}
            </span>
          ) : null}
        </>
      }
      search={
        <DataTableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={t("searchPlaceholder")}
        />
      }
      addFilter={
        <DataTableAddFilter
          fields={fields}
          usedFields={usedFields}
          onPickField={(fieldId) =>
            onFiltersChange(upsertAbandonedCartFilter(filters, fieldId, []))
          }
          onPickValue={(fieldId, value) =>
            onFiltersChange(
              upsertAbandonedCartFilter(filters, fieldId, [value]),
            )
          }
        />
      }
      trailing={
        <AbandonedCartsViewOptions
          table={table}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={onSortChange}
          labels={columnLabels}
          onExport={onExport}
          onExportOps={onExportOps}
          exportOpsBusy={exportOpsBusy}
        />
      }
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
