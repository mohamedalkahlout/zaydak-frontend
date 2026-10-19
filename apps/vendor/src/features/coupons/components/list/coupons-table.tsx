"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import {
  type RowSelectionState,
  type SortingState,
  type Updater,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { GET_COUPONS } from "@/features/coupons/api"
import type { Coupon, CouponsResponse } from "@/features/coupons/types"
import { Button } from "@repo/ui/components/button"
import type { Filter } from "@/shared/components/filter-bar"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
  DataTableSelectionBar,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { PAGE_SIZE } from "@/features/coupons/lib/list/constants"
import {
  EMPTY_COUPON_FILTER_SIGNATURE,
  couponFilterSignature,
  toCouponFilterQuery,
  toCouponFilters,
} from "@/features/coupons/lib/list/filters"
import {
  type CouponListQueryState,
  parseCouponListQueryState,
  toCouponListVariables,
} from "@/features/coupons/lib/list/query-state"
import { useSearchReplace } from "@/shared/hooks/use-search-replace"
import { couponColumns } from "./coupons-columns"
import { CouponsHeader } from "./coupons-header"
import { CouponsToolbar } from "./coupons-toolbar"
import { CouponsEmpty } from "./coupons-empty"

export function CouponsTable() {
  const t = useTranslations("coupons")
  const locale = useLocale()
  const columns = useMemo(() => couponColumns(t, locale), [t, locale])
  const { searchParams, base, writeInFlight, replaceSearch } =
    useSearchReplace()
  const queryState = useMemo(
    () => parseCouponListQueryState(searchParams, PAGE_SIZE),
    [searchParams],
  )
  const baseState = useMemo(
    () => parseCouponListQueryState(new URLSearchParams(base), PAGE_SIZE),
    [base],
  )

  const { data, previousData } = useQuery<CouponsResponse>(GET_COUPONS, {
    variables: toCouponListVariables(queryState),
    notifyOnNetworkStatusChange: true,
  })

  const coupons = useMemo<Coupon[]>(
    () => (data ?? previousData)?.coupons?.data ?? [],
    [data, previousData],
  )
  const meta = (data ?? previousData)?.coupons?.meta
  const totalCount = meta?.total ?? coupons.length
  const totalPages = Math.max(meta?.total_pages ?? 1, 1)
  const currentPage = Math.min(
    Math.max(meta?.page ?? queryState.page, 1),
    totalPages,
  )
  const pageSize = meta?.limit ?? PAGE_SIZE

  const [sorting, setSorting] = useState<SortingState>([
    { id: "expire_at", desc: false },
  ])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  /**
   * The filter chips are state rather than a value derived from the URL on
   * every render, because a chip that has just been added holds no values yet:
   * deriving would drop it in the same frame it appeared and there would be
   * nothing left on screen to pick a value from.
   *
   * The URL is still what the query runs on, so the two are reconciled by the
   * signature stored beside them — the one this screen last wrote. A URL whose
   * filters say something else was changed by somebody other than the bar (the
   * back button, or the Reset below), and only then are the chips rebuilt from
   * it. Skipped while a replace is in flight: the committed URL still holds
   * the previous filters, and rebuilding from it would undo a field change
   * (Status → Type clears values, so the derived URL is empty) and drop the
   * chip. Adjusted during render rather than from an effect, so the chips
   * never commit a frame disagreeing with a URL that has actually landed.
   */
  const urlFilterSignature = useMemo(
    () => couponFilterSignature(queryState),
    [queryState],
  )
  const [applied, setApplied] = useState<{
    signature: string
    filters: Filter[]
  }>(() => ({
    signature: urlFilterSignature,
    filters: toCouponFilters(queryState),
  }))

  if (!writeInFlight && applied.signature !== urlFilterSignature) {
    setApplied({
      signature: urlFilterSignature,
      filters: toCouponFilters(queryState),
    })
  }

  const updateQuery = (
    patch: Partial<CouponListQueryState>,
    { resetPage = false }: { resetPage?: boolean } = {},
  ) => {
    const params = new URLSearchParams(base)

    const nextPage = resetPage ? 1 : (patch.page ?? baseState.page)
    params.set("page", String(nextPage))

    const pick = <K extends keyof CouponListQueryState>(key: K) =>
      key in patch ? patch[key] : baseState[key]

    const nextSearch = pick("search") as string | undefined
    const nextStatuses = pick("statuses") as string[] | undefined
    const nextTypes = pick("types") as string[] | undefined
    const nextScopes = pick("scopes") as string[] | undefined

    if (nextSearch) params.set("search", nextSearch)
    else params.delete("search")

    // Deprecated singular keys — drop on any update so URLs normalize.
    params.delete("status")
    params.delete("type")
    params.delete("scope")

    const setMulti = (key: string, values?: string[]) => {
      params.delete(key)
      if (values && values.length > 0) {
        for (const v of values) params.append(key, v)
      }
    }

    setMulti("statuses", nextStatuses)
    setMulti("types", nextTypes)
    setMulti("scopes", nextScopes)

    replaceSearch(params)
  }

  const handleFiltersChange = (next: Filter[]) => {
    const query = toCouponFilterQuery(next)
    setApplied({ signature: couponFilterSignature(query), filters: next })
    updateQuery(query, { resetPage: true })
  }

  // Reset clears the chips outright instead of letting the URL do it: a chip
  // with no values writes nothing to the URL, so the reconciliation above would
  // see no change and leave a half-built chip behind on a cleared bar.
  const handleReset = () => {
    setApplied({ signature: EMPTY_COUPON_FILTER_SIGNATURE, filters: [] })
    updateQuery(
      {
        page: 1,
        search: undefined,
        statuses: undefined,
        types: undefined,
        scopes: undefined,
      },
      { resetPage: true },
    )
  }

  const table = useReactTable({
    data: coupons,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize,
      },
    },
    initialState: {
      columnVisibility: {
        minimum_cart_amount: false,
        value: false,
      },
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: totalPages,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater: Updater<{ pageIndex: number; pageSize: number }>) => {
      const nextPagination =
        typeof updater === "function"
          ? updater({ pageIndex: currentPage - 1, pageSize })
          : updater

      if (nextPagination.pageIndex !== currentPage - 1) {
        updateQuery({ page: nextPagination.pageIndex + 1 })
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const hasFilters =
    !!queryState.search ||
    !!queryState.statuses?.length ||
    !!queryState.types?.length ||
    !!queryState.scopes?.length ||
    applied.filters.length > 0
  const selectedCount = table.getSelectedRowModel().rows.length
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = totalCount === 0 ? 0 : pageStart + coupons.length - 1

  if (totalCount === 0 && !hasFilters) {
    return (
      <div className="flex flex-col gap-4">
        <CouponsHeader />
        <CouponsEmpty standalone />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CouponsHeader />

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
          <CouponsToolbar
            table={table}
            search={baseState.search ?? ""}
            filters={applied.filters}
            onSearchChange={(search) =>
              updateQuery(
                { search: search.trim() || undefined },
                { resetPage: true },
              )
            }
            onFiltersChange={handleFiltersChange}
            onReset={handleReset}
          />
        )}
        <DataTable
          table={table}
          emptyState={hasFilters ? <CouponsEmpty hasFilters /> : undefined}
        />

        {totalPages > 1 && (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t.rich("table.showing", {
                start: pageStart,
                end: pageEnd,
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
