"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSuspenseQuery } from "@apollo/client/react"
import {
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type Updater,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { GET_SEGMENTS } from "@/features/segments/api"
import type {
  Segment,
  SegmentsResponse,
} from "@/features/segments/types"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { PAGE_SIZE } from "@/features/segments/lib/constants"
import { segmentQueryText } from "@/features/segments/lib/helpers"
import { buildSegmentColumns } from "./segments-columns"
import { SegmentsHeader } from "./segments-header"
import { SegmentsToolbar } from "./segments-toolbar"
import { SegmentsEmpty } from "./segments-empty"

export function SegmentsTable() {
  const t = useTranslations("segments.table")
  const tRelative = useTranslations("segments.relativeTime")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""

  const { data } = useSuspenseQuery<SegmentsResponse>(GET_SEGMENTS, {
    variables: { page: 1, limit: 50 },
  })

  const allSegments = useMemo<Segment[]>(
    () => data?.customerSegments?.data ?? [],
    [data],
  )
  const columns = useMemo(
    () => buildSegmentColumns({ shopSlug, t, tRelative }),
    [shopSlug, t, tRelative],
  )

  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const resetToFirstPage = () =>
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))

  const handleColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
    setColumnFilters(updater)
    resetToFirstPage()
  }

  const handleGlobalFilterChange = (updater: Updater<string>) => {
    setGlobalFilter(updater)
    resetToFirstPage()
  }

  const table = useReactTable({
    data: allSegments,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _id, value: string) => {
      const v = (value ?? "").trim().toLowerCase()
      if (!v) return true
      const s = row.original
      return (
        s.name.toLowerCase().includes(v) ||
        (s.description ?? "").toLowerCase().includes(v) ||
        segmentQueryText(s).toLowerCase().includes(v)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const pageStart = table.getState().pagination.pageIndex * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredCount)
  const hasFilters = globalFilter.trim() !== "" || columnFilters.length > 0

  if (allSegments.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SegmentsHeader totalCount={0} />
        <SegmentsEmpty standalone />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentsHeader totalCount={allSegments.length} />

      <DataTableCard>
        <SegmentsToolbar table={table} />
        <DataTable
          table={table}
          emptyState={hasFilters ? <SegmentsEmpty hasFilters /> : undefined}
        />

        {filteredCount > PAGE_SIZE && (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t.rich("showing", {
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
