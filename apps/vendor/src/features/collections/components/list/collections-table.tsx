"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSuspenseQuery } from "@apollo/client/react"
import {
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import type { ShopCollection, ShopCollectionsResponse } from "@/features/collections/types"
import { Button } from "@repo/ui/components/button"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
  DataTableSelectionBar,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import type { Filter } from "@/shared/components/filter-bar"
import { PAGE_SIZE } from "@/features/collections/lib/list/constants"
import { toColumnFilters } from "@/features/collections/lib/list/filters"
import { collectionName } from "@/features/collections/lib/list/helpers"
import { buildCollectionColumns } from "./collections-columns"
import { CollectionsHeader } from "./collections-header"
import { CollectionsToolbar } from "./collections-toolbar"
import { CollectionsEmpty } from "./collections-empty"

export function CollectionsTable() {
  const t = useTranslations("collections")
  const params = useParams<{ shopSlug: string }>()
  const { data } = useSuspenseQuery<ShopCollectionsResponse>(GET_SHOP_COLLECTIONS, {
    variables: { page: 1, limit: 50 },
  })

  const rows: ShopCollection[] = data?.collections?.data ?? []

  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ])
  // The chips are the state the screen holds; `columnFilters` is a view of
  // them. Deriving it the other way round — chips read back out of
  // `columnFilters` — would drop a chip the moment it was added, since one
  // with no value yet contributes no column filter, and picking its value
  // would never become possible.
  const [filters, setFilters] = useState<Filter[]>([])
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
    resetToFirstPage()
  }

  /**
   * The bar's Clear, which this screen owns: it empties the chips and the
   * search box together. It clears the chips outright rather than going through
   * `table.resetColumnFilters()` — `columnFilters` is derived from the chips,
   * so resetting it would leave a chip with no value still sitting on a bar
   * the merchant had just cleared.
   */
  const handleReset = () => {
    setFilters([])
    setGlobalFilter("")
    resetToFirstPage()
  }

  const handleGlobalFilterChange = (updater: Updater<string>) => {
    setGlobalFilter(updater)
    resetToFirstPage()
  }

  const columns = useMemo(
    () => buildCollectionColumns(params?.shopSlug ?? "", t),
    [params?.shopSlug, t],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    // No `onColumnFiltersChange`: `columnFilters` is derived from the chips, so
    // the bar is the only thing that may write it and the table is handed the
    // result to read.
    onGlobalFilterChange: handleGlobalFilterChange,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _id, value: string) => {
      const v = (value ?? "").trim().toLowerCase()
      if (!v) return true
      const c = row.original
      return (
        collectionName(c.name).toLowerCase().includes(v) ||
        c.slug.toLowerCase().includes(v)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const pageStart = table.getState().pagination.pageIndex * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredCount)
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const hasFilters = globalFilter.trim() !== "" || columnFilters.length > 0

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <CollectionsHeader totalCount={0} />
        <CollectionsEmpty standalone />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CollectionsHeader totalCount={rows.length} />

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
          <CollectionsToolbar
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
              <CollectionsEmpty hasFilters />
            ) : undefined
          }
        />

        {filteredCount > PAGE_SIZE && (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t.rich("table.showing", {
                from: pageStart + 1,
                to: pageEnd,
                total: filteredCount,
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
