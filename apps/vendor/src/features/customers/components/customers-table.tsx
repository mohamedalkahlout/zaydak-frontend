"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import {
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { GET_CONTACTS } from "@/features/customers/api"
import type { Contact, ContactsResponse } from "@/features/customers/types"
import { Button } from "@repo/ui/components/button"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
  DataTableSelectionBar,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { PAGE_SIZE } from "@/features/customers/lib/constants"
import {
  INITIAL_CUSTOMER_FILTERS,
  filterQueryKey,
  toColumnFilters,
  toFilters,
} from "@/features/customers/lib/filters"
import type { Filter } from "@/shared/components/filter-bar"
import { buildCustomerColumns } from "./customers-columns"
import { CustomersHeader } from "./customers-header"
import { CustomersToolbar } from "./customers-toolbar"
import { CustomersEmpty } from "./customers-empty"

export function CustomersTable() {
  const t = useTranslations("customers")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""

  const columns = useMemo(
    () => buildCustomerColumns({ shopSlug, t }),
    [shopSlug, t],
  )

  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  /**
   * The filter chips are the state, and `columnFilters` is derived from them
   * rather than the other way round. A chip that has just been added holds no
   * values yet, so reading the bar back out of the applied filters would drop
   * it in the very render it appeared in and the pick-a-value step would never
   * be reached.
   */
  const [filters, setFilters] = useState<Filter[]>(() =>
    toFilters(INITIAL_CUSTOMER_FILTERS),
  )
  const columnFilters = useMemo(() => toColumnFilters(filters), [filters])
  const [globalFilter, setGlobalFilter] = useState("")
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const resetToFirstPage = () =>
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))

  const handleFiltersChange = (next: Filter[]) => {
    setFilters(next)
    // Only a change to what is actually sent moves the page, which is all the
    // old column-filter handler could ever see: adding a chip with no value
    // yet narrows nothing, and paging a merchant back to the first row for it
    // would be a reset with nothing behind it.
    if (filterQueryKey(next) !== filterQueryKey(filters)) resetToFirstPage()
  }

  // This is the bar's Clear, handed to the screen: the bar can only see chips,
  // and the search box has to go with them or there are two controls that both
  // half-clear the list.
  const handleResetFilters = () => {
    setFilters([])
    setGlobalFilter("")
    resetToFirstPage()
  }

  const handleGlobalFilterChange = (updater: Updater<string>) => {
    setGlobalFilter(updater)
    resetToFirstPage()
  }

  const statusVal = columnFilters.find((f) => f.id === "status")?.value
  const statusFilter = Array.isArray(statusVal) ? statusVal[0] : (statusVal as string | undefined)

  const { data, previousData } = useQuery<ContactsResponse>(GET_CONTACTS, {
    variables: {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      status: statusFilter || undefined,
      search: globalFilter.trim() || undefined,
    },
    notifyOnNetworkStatusChange: true,
  })

  const allContacts = useMemo<Contact[]>(
    () => (data ?? previousData)?.contacts?.data ?? [],
    [data, previousData],
  )
  const totalCount =
    (data ?? previousData)?.contacts?.meta?.total ?? allContacts.length

  const table = useReactTable({
    data: allContacts,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      pagination,
    },
    manualPagination: true,
    manualFiltering: true,
    rowCount: totalCount,
    enableRowSelection: true,
    autoResetPageIndex: false,
    onSortingChange: (updater) => {
      setSorting(updater)
      resetToFirstPage()
    },
    // No `onColumnFiltersChange`: `columnFilters` is derived from the chips, so
    // the bar is the only thing that may write it and the table is handed the
    // result to read.
    onGlobalFilterChange: handleGlobalFilterChange,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  })

  const pageStart = pagination.pageIndex * pagination.pageSize
  const pageEnd = Math.min(pageStart + allContacts.length, totalCount)
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const hasFilters = globalFilter.trim() !== "" || columnFilters.length > 0

  if (allContacts.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col gap-4">
        <CustomersHeader totalCount={0} />
        <CustomersEmpty standalone />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CustomersHeader totalCount={totalCount} />

      <DataTableCard>
        {selectedCount > 0 ? (
          <DataTableSelectionBar>
            <span>{t("table.selected", { count: selectedCount })}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetRowSelection()}
            >
              {t("table.clearSelection")}
            </Button>
          </DataTableSelectionBar>
        ) : (
          <CustomersToolbar
            table={table}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleResetFilters}
          />
        )}
        <DataTable
          table={table}
          emptyState={hasFilters ? <CustomersEmpty hasFilters /> : undefined}
        />

        {totalCount > pagination.pageSize && (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t.rich("table.showing", {
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
