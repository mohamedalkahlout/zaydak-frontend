"use client"

import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
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
import type { Order } from "@/features/orders/types"
import { orderFilterFields } from "@/features/orders/lib/list/filters"
import { CreatedRangePicker } from "./created-range-picker"

interface OrdersToolbarProps {
  table: Table<Order>
  filters: Filter[]
  onFiltersChange: (filters: Filter[]) => void
  onReset: () => void
}

/**
 * The Display menu's name for each column id, as a key under `orders.columns`
 * — the same words the column headers themselves read.
 */
const COLUMN_LABEL_KEYS: Record<string, string> = {
  tracking_number: "order",
  created_at: "date",
  customer: "customer",
  total: "total",
  payment_status: "payment",
  order_status: "status",
  items: "items",
}

export function OrdersToolbar({
  table,
  filters,
  onFiltersChange,
  onReset,
}: OrdersToolbarProps) {
  const t = useTranslations("orders")
  const tFilterBar = useTranslations("filterBar")
  const tChannels = useTranslations("salesChannels")
  const tAnalytics = useTranslations("analytics")
  const locale = useLocale()
  const fields = useMemo(
    () =>
      orderFilterFields(
        t,
        {
          isAnyOf: tFilterBar("isAnyOf"),
          channelName: (channel) => tChannels(`names.${channel}`),
          is: tFilterBar("is"),
          rangeName: (preset) => tAnalytics(`ranges.${preset}`),
        },
        {
          locale,
          valueExtra: ({ values, commit }) => (
            <CreatedRangePicker
              value={values[0]}
              onCommit={(encoded) => commit([encoded])}
            />
          ),
        },
      ),
    [t, tFilterBar, tChannels, tAnalytics, locale],
  )
  const columnLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(COLUMN_LABEL_KEYS).map(([id, key]) => [
          id,
          t(`columns.${key}`),
        ]),
      ),
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
          placeholder={t("list.searchPlaceholder")}
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
