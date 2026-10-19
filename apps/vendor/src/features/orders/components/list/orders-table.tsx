"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  type PaginationState,
  type SortingState,
  type RowSelectionState,
  type Updater,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { GET_ORDERS } from "@/features/orders/api"
import type { Order, OrdersResponse, OrderFilters } from "@/features/orders/types"
import { Button } from "@repo/ui/components/button"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
  DataTableSelectionBar,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { PAGE_SIZE } from "@/features/orders/lib/list/constants"
import {
  CREATED_FIELD,
  createdWindow,
  msUntilNextLocalMidnight,
  todayAnchorStale,
  toQuery,
} from "@/features/orders/lib/list/filters"
import type { Filter } from "@/shared/components/filter-bar"
import { orderColumns } from "./orders-columns"
import { OrdersHeader } from "./orders-header"
import { OrdersToolbar } from "./orders-toolbar"
import { OrdersEmpty } from "./orders-empty"

const SORT_FIELD_MAP: Record<string, string> = {
  created_at: "created_at",
  order_status: "order_status",
  total: "total",
  updated_at: "updated_at",
}

export function OrdersTable() {
  const t = useTranslations("orders.list")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [filters, setFilters] = useState<Filter[]>([])
  // "Now" for the date chip, anchored in state rather than read during render:
  // the window is an Apollo variable, and one recomputed on every render would
  // never keep its identity. Re-anchored whenever the filters change.
  const [windowAnchor, setWindowAnchor] = useState(() => new Date())
  const [globalFilter, setGlobalFilter] = useState("")
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  // The filter bar owns the applied filters, so TanStack's `columnFilters` is
  // derived from them rather than held beside them: a second copy would let a
  // chip and the query it produced disagree for a render, and a chip that has
  // just been added has no values yet, so a bar reading this array back would
  // drop it the instant it appeared.
  const columnFilters = useMemo(() => toQuery(filters), [filters])

  // Build backend filters from frontend state
  const backendFilters = useMemo((): OrderFilters => {
    const f: OrderFilters = {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      sort_by: "created_at",
      sort_order: "desc",
    }

    // Sorting
    if (sorting.length > 0) {
      const field = SORT_FIELD_MAP[sorting[0].id]
      if (field) {
        f.sort_by = field
        f.sort_order = sorting[0].desc ? "desc" : "asc"
      }
    }

    // Column filters
    for (const cf of columnFilters) {
      const vals = cf.value as string[] | undefined
      if (cf.id === "order_status" && vals?.length) {
        f.order_status = vals.join(",")
      } else if (cf.id === "payment_status" && vals?.length) {
        f.payment_status = vals.join(",")
      } else if (cf.id === "channel" && vals?.length) {
        f.channel = vals.join(",")
      } else if (cf.id === CREATED_FIELD && vals?.length) {
        Object.assign(f, createdWindow(vals[0], windowAnchor))
      }
    }

    // Search (tracking number or customer name)
    const q = globalFilter.trim()
    if (q) {
      if (/\d/.test(q)) {
        f.tracking_number = q
      } else {
        f.customer_name = q
      }
    }

    return f
  }, [
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    windowAnchor,
  ])

  const { data, previousData } = useQuery<OrdersResponse>(GET_ORDERS, {
    variables: { filters: backendFilters },
    notifyOnNetworkStatusChange: true,
  })

  // Use previous data while loading to keep table visible
  const allOrders = useMemo<Order[]>(
    () => (data ?? previousData)?.orders?.data ?? [],
    [data, previousData],
  )
  const totalCount =
    (data ?? previousData)?.orders?.meta?.total ?? allOrders.length

  const resetToFirstPage = () =>
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))

  const handleFiltersChange = (next: Filter[]) => {
    setFilters(next)
    setWindowAnchor(new Date())
    resetToFirstPage()
  }

  // A Today chip left open past midnight keeps yesterday's start until the
  // filters change. The timeout is the only writer: picking the chip already
  // re-anchors, and a synchronous set here would be state seeded from an effect.
  const createdValue = filters.find((filter) => filter.field === CREATED_FIELD)
    ?.values[0]
  useEffect(() => {
    if (createdValue !== "today") return
    let timer = 0
    const arm = () => {
      timer = window.setTimeout(() => {
        const now = new Date()
        setWindowAnchor((anchor) =>
          todayAnchorStale(anchor, now) ? now : anchor,
        )
        arm()
      }, msUntilNextLocalMidnight(new Date()))
    }
    arm()
    return () => window.clearTimeout(timer)
  }, [createdValue])

  // Reset is the toolbar's one control and it lands here rather than in
  // TanStack: the bar's Clear can only reach the chips, and the search box has
  // to go with them. Clearing the chips clears `columnFilters`, which is
  // derived from them.
  const handleReset = () => {
    setFilters([])
    setGlobalFilter("")
    resetToFirstPage()
  }

  const handleGlobalFilterChange = (updater: Updater<string>) => {
    setGlobalFilter(updater)
    resetToFirstPage()
  }

  const table = useReactTable({
    data: allOrders,
    columns: orderColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      pagination,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: totalCount,
    enableRowSelection: true,
    autoResetPageIndex: false,
    onSortingChange: (updater) => {
      setSorting(updater)
      resetToFirstPage()
    },
    // No `onColumnFiltersChange`: `columnFilters` is derived from the chips,
    // so the bar is the only thing that may write it and the table is handed
    // the result to read.
    onGlobalFilterChange: handleGlobalFilterChange,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  const pageStart = pagination.pageIndex * pagination.pageSize
  const pageEnd = Math.min(pageStart + allOrders.length, totalCount)

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const hasFilters =
    globalFilter.trim() !== "" ||
    columnFilters.some(
      (f) =>
        f.value &&
        Array.isArray(f.value) &&
        f.value.length > 0 &&
        f.value[0] !== "all",
    )

  // Truly empty (no orders at all) → skip toolbar + card, show big empty state.
  if (allOrders.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col gap-4">
        <OrdersHeader totalCount={0} />
        <OrdersEmpty standalone />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <OrdersHeader totalCount={totalCount} filters={backendFilters} />

      <DataTableCard>
        {selectedCount > 0 ? (
          <DataTableSelectionBar>
            <span>{t("selected", { count: selectedCount })}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetRowSelection()}
            >
              {t("clearSelection")}
            </Button>
          </DataTableSelectionBar>
        ) : (
          <OrdersToolbar
            table={table}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleReset}
          />
        )}
        <DataTable
          table={table}
          emptyState={
            hasFilters ? (
              <OrdersEmpty hasFilters />
            ) : undefined
          }
        />

        {totalCount > pagination.pageSize && (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t.rich("showing", {
                from: totalCount === 0 ? 0 : pageStart + 1,
                to: pageEnd,
                total: totalCount,
                b: (chunks) => (
                  <span className="font-medium text-foreground">{chunks}</span>
                ),
              })}
            </p>
            <DataTablePagination table={table} />
          </DataTableFooter>
        )}
      </DataTableCard>

    </div>
  )
}
