"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  useApolloClient,
  useMutation,
  useQuery,
} from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  type Table,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { useThrottledCallback } from "@/shared/hooks/use-throttled-callback"
import {
  GET_ABANDONED_CART_IDS,
  GET_ABANDONED_CART_OPS,
  GET_ABANDONED_CART_STATUS_COUNTS,
  GET_ABANDONED_CARTS,
  GET_ABANDONED_CARTS_BY_PRODUCT,
  GET_ABANDONED_CARTS_SUMMARY,
  HIDE_ABANDONED_CARTS,
} from "@/features/abandoned-carts/api"
import type {
  AbandonedCart,
  AbandonedCartIdsResponse,
  AbandonedCartOpsResponse,
  AbandonedCartProductRow,
  AbandonedCartStatusCountsResponse,
  AbandonedCartsByProductResponse,
  AbandonedCartsResponse,
  AbandonedCartsSummaryResponse,
  AbandonedCartsView,
  HideAbandonedCartsResponse,
} from "@/features/abandoned-carts/types"
import type { AbandonedCartsQueryState } from "@/features/abandoned-carts/lib/query-state"
import type { Filter } from "@/shared/components/filter-bar"
import {
  EMPTY_ABANDONED_CART_FILTER_SIGNATURE,
  abandonedCartFilterSignature,
  toAbandonedCartFilterQuery,
  toAbandonedCartFilters,
  toAbandonedCartStatusCounts,
} from "@/features/abandoned-carts/lib/filters"
import {
  abandonedCartSelectionScope,
  parseAbandonedCartsQueryState,
  toAbandonedCartIdsVariables,
  toAbandonedCartStatusCountVariables,
  toAbandonedCartsSearchParams,
  toAbandonedCartsSummaryVariables,
  toAbandonedCartsVariables,
  type RangePreset,
} from "@/features/abandoned-carts/lib/query-state"
import {
  HIDE_BATCH_LIMIT,
  OPS_EXPORT_LIMIT,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SELECTION_PAGE_LIMIT,
  SELECTION_SCAN_PAGES,
} from "@/features/abandoned-carts/lib/constants"
import {
  chunkIds,
  remindableCarts,
  selectAllBanner,
  selectedIdsOf,
  useCartSelection,
} from "@/features/abandoned-carts/lib/selection"
import {
  columnPrefsKey,
  useColumnVisibility,
} from "@/features/abandoned-carts/lib/column-prefs"
import {
  abandonedCartOpsCsvRows,
  downloadCsv,
  toCsv,
} from "@/features/abandoned-carts/lib/export-csv"
import { useSearchReplace } from "@/shared/hooks/use-search-replace"
import { abandonedCartColumns } from "./abandoned-carts-columns"
import { abandonedCartProductColumns } from "./abandoned-carts-product-columns"
import { AbandonedCartsToolbar } from "./abandoned-carts-toolbar"
import { AbandonedCartsEmpty } from "./abandoned-carts-empty"
import { AbandonedCartsKpis } from "./abandoned-carts-kpis"
import { AbandonedCartReminderSheet } from "./abandoned-cart-reminder-sheet"
import { AbandonedCartsItemsSheet } from "./abandoned-carts-items-sheet"
import { AbandonedCartsBulkBar } from "./abandoned-carts-bulk-bar"
import { sileo } from "sileo"

export function AbandonedCartsTable() {
  const t = useTranslations("abandonedCarts")
  const { searchParams, base, writeInFlight, replaceSearch } =
    useSearchReplace()
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  const queryState = useMemo(
    () => parseAbandonedCartsQueryState(searchParams),
    [searchParams],
  )
  const baseState = useMemo(
    () => parseAbandonedCartsQueryState(new URLSearchParams(base)),
    [base],
  )
  const [searchInput, setSearchInput] = useState(queryState.search ?? "")
  const [remindCarts, setRemindCarts] = useState<AbandonedCart[]>([])
  const [itemsCart, setItemsCart] = useState<AbandonedCart | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const [opsExporting, setOpsExporting] = useState(false)
  const client = useApolloClient()
  // The instant every rolling window ends at ("last 7 days", a custom range
  // that reaches today, a created-date chip). Held in state, not read in
  // render: a fresh `new Date()` per render is a new `end` per render, which
  // Apollo treats as new variables — every query here refetched in a loop for
  // as long as a dated range was on. It moves on when the merchant picks a
  // range, which is when they are asking what the window holds now.
  const [now, setNow] = useState(() => new Date())
  const listVariables = toAbandonedCartsVariables(queryState, now)

  const cartQuery = useQuery<AbandonedCartsResponse>(GET_ABANDONED_CARTS, {
    variables: listVariables,
    notifyOnNetworkStatusChange: true,
    skip: queryState.view !== "customer",
  })
  const productQuery = useQuery<AbandonedCartsByProductResponse>(
    GET_ABANDONED_CARTS_BY_PRODUCT,
    {
      variables: listVariables,
      notifyOnNetworkStatusChange: true,
      skip: queryState.view !== "product",
    },
  )

  const activeQuery = queryState.view === "product" ? productQuery : cartQuery
  const cartPayload = (cartQuery.data ?? cartQuery.previousData)?.abandonedCarts
  const productPayload =
    (productQuery.data ?? productQuery.previousData)?.abandonedCartsByProduct
  const carts = cartPayload?.data ?? []
  const products = productPayload?.data ?? []
  const meta =
    queryState.view === "product" ? productPayload?.meta : cartPayload?.meta
  const summaryQuery = useQuery<AbandonedCartsSummaryResponse>(
    GET_ABANDONED_CARTS_SUMMARY,
    {
      variables: toAbandonedCartsSummaryVariables(queryState, now),
    },
  )
  const summary = (summaryQuery.data ?? summaryQuery.previousData)
    ?.abandonedCartsSummary.data
  const unfilteredTotal = summary?.total_abandoned
  // The number beside each status option. It is the list's own filter minus
  // the status — search, value, created date, hidden and the date range all
  // apply — so each count is the total the list shows once that status is
  // picked, whichever one is picked now.
  const countsQuery = useQuery<AbandonedCartStatusCountsResponse>(
    GET_ABANDONED_CART_STATUS_COUNTS,
    {
      variables: toAbandonedCartStatusCountVariables(queryState, now),
    },
  )
  const byStatus = (countsQuery.data ?? countsQuery.previousData)
    ?.abandonedCartStatusCounts.data
  const statusCounts = useMemo(
    () => toAbandonedCartStatusCounts(byStatus),
    [byStatus],
  )
  const firstLoad = activeQuery.loading && !meta
  const error = activeQuery.error
  const totalCount = meta?.total ?? 0
  const totalPages = Math.max(meta?.total_pages ?? 1, 1)
  const currentPage = Math.min(Math.max(meta?.page ?? queryState.page, 1), totalPages)
  const pageSize = meta?.limit ?? queryState.limit ?? PAGE_SIZE

  const urlFilterSignature = useMemo(
    () =>
      abandonedCartFilterSignature({
        reminderStatus: queryState.reminderStatus,
        includeHidden: queryState.includeHidden,
        valueBand: queryState.valueBand,
        created: queryState.created,
      }),
    [queryState],
  )
  const [applied, setApplied] = useState<{
    signature: string
    filters: Filter[]
  }>(() => ({
    signature: urlFilterSignature,
    filters: toAbandonedCartFilters(queryState),
  }))
  if (!writeInFlight && applied.signature !== urlFilterSignature) {
    setApplied({
      signature: urlFilterSignature,
      filters: toAbandonedCartFilters(queryState),
    })
  }

  const updateQuery = (
    patch: Partial<AbandonedCartsQueryState>,
    { resetPage = false }: { resetPage?: boolean } = {},
  ) => {
    const next: AbandonedCartsQueryState = {
      ...baseState,
      ...patch,
      page: resetPage ? 1 : (patch.page ?? baseState.page),
    }
    replaceSearch(toAbandonedCartsSearchParams(next))
  }

  const commitSearch = useThrottledCallback(
    (value: string) => {
      updateQuery({ search: value.trim() || undefined }, { resetPage: true })
    },
    400,
    [searchParams],
  )

  const handleFiltersChange = (next: Filter[]) => {
    const query = toAbandonedCartFilterQuery(next)
    setApplied({
      signature: abandonedCartFilterSignature(query),
      filters: next,
    })
    const hadCustomer = applied.filters.some((f) => f.field === "customer")
    const hasCustomerChip = next.some((f) => f.field === "customer")
    const patch = {
      reminderStatus: query.reminderStatus,
      includeHidden: query.includeHidden,
      valueBand: query.valueBand,
      created: query.created,
    }
    if (query.customer) {
      setSearchInput(query.customer)
      updateQuery({ ...patch, search: query.customer }, { resetPage: true })
      return
    }
    if (hadCustomer && !hasCustomerChip) {
      setSearchInput("")
      updateQuery({ ...patch, search: undefined }, { resetPage: true })
      return
    }
    updateQuery(patch, { resetPage: true })
  }

  const handleReset = () => {
    commitSearch.cancel()
    setSearchInput("")
    setApplied({ signature: EMPTY_ABANDONED_CART_FILTER_SIGNATURE, filters: [] })
    updateQuery(
      {
        page: 1,
        search: undefined,
        reminderStatus: undefined,
        includeHidden: undefined,
        valueBand: undefined,
        created: undefined,
      },
      { resetPage: true },
    )
  }

  const onRangeChange = (next: {
    range: RangePreset
    from?: string
    to?: string
  }) => {
    setNow(new Date())
    updateQuery(next, { resetPage: true })
  }

  // One selection for the whole list, not for the page: it keeps ticks made
  // on other pages and holds every id "select all matching" returns. It
  // belongs to the filter it was made under and is gone when that changes.
  const selectionScope = abandonedCartSelectionScope(queryState)
  const selection = useCartSelection(selectionScope)
  const rowSelection = selection.rowSelection
  const customerColumnLabels = {
    customer: t("columns.customer"),
    products: t("columns.products"),
    total: t("columns.total"),
    updated: t("columns.updated"),
    status: t("columns.status"),
    country: t("columns.country"),
    created: t("columns.created"),
  }
  const productColumnLabels = {
    product: t("columns.product"),
    carts: t("columns.carts"),
    lost: t("columns.lost"),
    lastLeft: t("columns.lastLeft"),
  }
  const [customerVisibility, setCustomerVisibility] = useColumnVisibility(
    columnPrefsKey(shopSlug, "customer"),
    { country: false, created: false },
  )
  const [productVisibility, setProductVisibility] = useColumnVisibility(
    columnPrefsKey(shopSlug, "product"),
    {},
  )

  const cartColumns = useMemo(
    () =>
      abandonedCartColumns({
        shopSlug,
        labels: {
          ...customerColumnLabels,
          guest: t("guest"),
          actions: t("columns.actions"),
          daysAgo: (days) => t("daysAgo", { days }),
          remind: t("actions.remind"),
          chatWhatsApp: t("chatWhatsApp"),
          selectAll: t("selection.selectAll"),
          selectRow: t("selection.selectRow"),
        },
        onRemind: (cart) => setRemindCarts([cart]),
        onOpenItems: setItemsCart,
      }),
    [shopSlug, t],
  )
  const productColumns = useMemo(
    () =>
      abandonedCartProductColumns({
        labels: {
          ...productColumnLabels,
          selectAll: t("selection.selectAll"),
          selectRow: t("selection.selectRow"),
        },
      }),
    [t],
  )

  const customerTable = useReactTable({
    data: carts,
    columns: cartColumns,
    state: {
      rowSelection,
      columnVisibility: customerVisibility,
      pagination: { pageIndex: currentPage - 1, pageSize },
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: totalPages,
    autoResetPageIndex: false,
    onRowSelectionChange: selection.onRowSelectionChange,
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(customerVisibility) : updater
      setCustomerVisibility(next)
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: currentPage - 1, pageSize })
          : updater
      if (next.pageIndex !== currentPage - 1) {
        updateQuery({ page: next.pageIndex + 1 })
      }
      if (next.pageSize !== pageSize) {
        updateQuery({ limit: next.pageSize, page: 1 }, { resetPage: true })
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  })

  const productTable = useReactTable({
    data: products,
    columns: productColumns,
    state: {
      rowSelection,
      columnVisibility: productVisibility,
      pagination: { pageIndex: currentPage - 1, pageSize },
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: totalPages,
    autoResetPageIndex: false,
    onRowSelectionChange: selection.onRowSelectionChange,
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(productVisibility) : updater
      setProductVisibility(next)
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: currentPage - 1, pageSize })
          : updater
      if (next.pageIndex !== currentPage - 1) {
        updateQuery({ page: next.pageIndex + 1 })
      }
      if (next.pageSize !== pageSize) {
        updateQuery({ limit: next.pageSize, page: 1 }, { resetPage: true })
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.product_id,
  })

  const table =
    queryState.view === "product" ? productTable : customerTable
  const listTable = table as unknown as Table<unknown>
  // Carts are selected by id across the whole list, so the count and every
  // bulk action cover ticks that are not on the page in view. Product rows
  // are aggregates with nothing but an export, and stay page-selected.
  const selectedIds = useMemo(() => selectedIdsOf(rowSelection), [rowSelection])
  const selectedProducts = productTable
    .getSelectedRowModel()
    .rows.map((row) => row.original)
  const selectedCount =
    queryState.view === "product" ? selectedProducts.length : selectedIds.length
  const banner =
    queryState.view === "customer"
      ? selectAllBanner({
          allPageRowsSelected: customerTable.getIsAllPageRowsSelected(),
          pageRowCount: carts.length,
          total: totalCount,
          selectedCount: selectedIds.length,
          matching: selection.matching,
        })
      : null

  const hasListFilters = Boolean(
    queryState.search ||
      queryState.reminderStatus ||
      queryState.includeHidden ||
      queryState.valueBand ||
      queryState.created,
  )
  const hiddenCount =
    hasListFilters && unfilteredTotal != null
      ? Math.max(0, unfilteredTotal - totalCount)
      : 0

  const [hideMany] = useMutation<HideAbandonedCartsResponse>(HIDE_ABANDONED_CARTS)
  const refetchQueries = [
    GET_ABANDONED_CARTS,
    GET_ABANDONED_CARTS_BY_PRODUCT,
    GET_ABANDONED_CARTS_SUMMARY,
    GET_ABANDONED_CART_STATUS_COUNTS,
  ]

  /**
   * "Select all matching": every id the list's filter matches, asked for only
   * when the offer is pressed. The answer is stamped with the scope it was
   * asked under, so one that lands after a chip changed selects nothing.
   */
  const selectAllMatching = async () => {
    if (selectingAll) return
    setSelectingAll(true)
    try {
      const result = await client.query<AbandonedCartIdsResponse>({
        query: GET_ABANDONED_CART_IDS,
        variables: toAbandonedCartIdsVariables(queryState, now),
        fetchPolicy: "network-only",
      })
      const payload = result.data?.abandonedCartIds
      if (!payload?.success) throw new Error("no id list")
      selection.selectMatching(selectionScope, payload.data, payload.total)
    } catch {
      sileo.error({ title: t("selection.failed") })
    } finally {
      setSelectingAll(false)
    }
  }

  /**
   * The selected carts as whole rows, which Remind and Export need and a
   * selection past this page does not have. Rows on screen are used as they
   * are; the rest are read back through the list's own query and filter,
   * `SELECTION_PAGE_LIMIT` at a time, until every id is found. Ids that are
   * still missing — a cart that left the list since it was ticked — are
   * reported, never silently dropped. `null` means the read itself failed.
   */
  const loadSelectedCarts = async (): Promise<AbandonedCart[] | null> => {
    const wanted = new Set(selectedIds)
    const found = new Map<string, AbandonedCart>()
    for (const cart of carts) {
      if (wanted.has(cart.id)) found.set(cart.id, cart)
    }
    try {
      for (
        let page = 1;
        found.size < wanted.size && page <= SELECTION_SCAN_PAGES;
        page += 1
      ) {
        const result = await client.query<AbandonedCartsResponse>({
          query: GET_ABANDONED_CARTS,
          variables: { ...listVariables, page, limit: SELECTION_PAGE_LIMIT },
          fetchPolicy: "network-only",
        })
        const payload = result.data?.abandonedCarts
        for (const cart of payload?.data ?? []) {
          if (wanted.has(cart.id)) found.set(cart.id, cart)
        }
        if (!payload || page >= payload.meta.total_pages) break
      }
    } catch {
      sileo.error({ title: t("toasts.selectionLoadFailed") })
      return null
    }
    const rows = selectedIds.flatMap((id) => {
      const cart = found.get(id)
      return cart ? [cart] : []
    })
    const missing = selectedIds.length - rows.length
    if (missing > 0) {
      sileo.warning({ title: t("toasts.selectionMissing", { count: missing }) })
    }
    return rows
  }

  /**
   * Opens the reminder sheet for the selection. Hidden and completed carts
   * cannot be reminded (the row's own button is disabled for them and the
   * back-end refuses the send), so they are taken out here and the merchant
   * is told how many, before the sheet names a number of customers.
   */
  const handleBulkRemind = async () => {
    if (bulkBusy) return
    setBulkBusy(true)
    const rows = await loadSelectedCarts()
    setBulkBusy(false)
    if (!rows) return
    const targets = remindableCarts(rows)
    if (targets.length === 0) {
      sileo.info({ title: t("toasts.remindNone") })
      return
    }
    if (targets.length < rows.length) {
      sileo.info({
        title: t("toasts.remindSkipped", {
          count: rows.length - targets.length,
        }),
      })
    }
    setRemindCarts(targets)
  }

  const exportCarts = (rows: AbandonedCart[]) => {
    const csv = toCsv([
      [
        "customer",
        "email",
        "phone",
        "country",
        "products",
        "item_count",
        "total_cents",
        "currency",
        "status",
        "last_activity_at",
        "created_at",
      ],
      ...rows.map((row) => [
        row.customer?.name ?? "",
        row.customer?.email ?? "",
        row.customer?.phone ?? "",
        row.customer?.country ?? "",
        row.items.map((item) => item.name).join("; "),
        String(row.item_count),
        row.total_cents == null ? "" : String(row.total_cents),
        row.currency,
        row.reminder_status,
        row.last_activity_at ?? "",
        row.created_at,
      ]),
    ])
    downloadCsv("abandoned-carts.csv", csv)
  }

  const exportProducts = (rows: AbandonedCartProductRow[]) => {
    const csv = toCsv([
      ["product", "cart_count", "lost_revenue_cents", "currency", "last_left_at"],
      ...rows.map((row) => [
        row.name,
        String(row.cart_count),
        row.lost_revenue_cents == null ? "" : String(row.lost_revenue_cents),
        row.currency,
        row.last_left_at ?? "",
      ]),
    ])
    downloadCsv("abandoned-carts-by-product.csv", csv)
  }

  /**
   * The list CSV: the selection when there is one — every selected cart,
   * whichever page it is on — and the page in view otherwise.
   */
  const handleExport = async () => {
    if (queryState.view === "product") {
      exportProducts(selectedProducts.length ? selectedProducts : products)
      return
    }
    if (selectedIds.length === 0) {
      exportCarts(carts)
      return
    }
    if (bulkBusy) return
    setBulkBusy(true)
    const rows = await loadSelectedCarts()
    setBulkBusy(false)
    if (rows && rows.length > 0) exportCarts(rows)
  }

  /**
   * The send / hide / unhide log for the KPI date range, fetched on demand
   * rather than kept in a query: nobody reads it on screen, and a standing
   * query would refetch it on every range change for a button rarely pressed.
   */
  const handleExportOps = async () => {
    if (opsExporting) return
    setOpsExporting(true)
    try {
      const result = await client.query<AbandonedCartOpsResponse>({
        query: GET_ABANDONED_CART_OPS,
        variables: {
          ...toAbandonedCartsSummaryVariables(queryState),
          page: 1,
          limit: OPS_EXPORT_LIMIT,
        },
        fetchPolicy: "network-only",
      })
      const rows = result.data?.abandonedCartOps.data ?? []
      if (rows.length === 0) {
        sileo.info({ title: t("toasts.opsExportEmpty") })
        return
      }
      downloadCsv(
        "abandoned-carts-activity.csv",
        toCsv(abandonedCartOpsCsvRows(rows)),
      )
      if (rows.length >= OPS_EXPORT_LIMIT) {
        sileo.warning({
          title: t("toasts.opsExportCapped", { count: OPS_EXPORT_LIMIT }),
        })
      }
    } catch {
      sileo.error({ title: t("toasts.opsExportFailed") })
    } finally {
      setOpsExporting(false)
    }
  }

  /**
   * Hides or shows every selected cart. `hideAbandonedCarts` takes at most
   * `HIDE_BATCH_LIMIT` ids a call, so a longer selection goes out as several
   * calls of that size — the whole selection, in order, nothing cut. If one
   * call fails the toast says how many carts were reached before it, and the
   * selection is kept so the rest can be retried.
   */
  const runBulkHide = async (hidden: boolean) => {
    const ids = selectedIds
    if (ids.length === 0 || bulkBusy) return
    setBulkBusy(true)
    let sent = 0
    let updated = 0
    try {
      for (const batch of chunkIds(ids, HIDE_BATCH_LIMIT)) {
        const result = await hideMany({
          variables: { input: { ids: batch, hidden } },
        })
        sent += batch.length
        updated += result.data?.hideAbandonedCarts.updated ?? batch.length
      }
      sileo.success({
        title: hidden
          ? t("toasts.hiddenMany", { count: updated })
          : t("toasts.shownMany", { count: updated }),
      })
      selection.clear()
    } catch {
      sileo.error({
        title:
          sent === 0
            ? t("toasts.hideFailed")
            : t("toasts.bulkPartial", { done: sent, total: ids.length }),
      })
    } finally {
      // Once, after the last batch — not once per batch.
      if (sent > 0) {
        await client
          .refetchQueries({ include: refetchQueries })
          .catch(() => undefined)
      }
      setBulkBusy(false)
    }
  }

  const tableBody =
    error && !meta ? (
      <AbandonedCartsError />
    ) : firstLoad ? (
      <AbandonedCartsTableSkeleton />
    ) : (
      <>
        <DataTable
          table={listTable}
          emptyState={
            <AbandonedCartsEmpty
              hasFilters={hasListFilters}
              hiddenCount={hiddenCount}
              onClear={hasListFilters ? handleReset : undefined}
            />
          }
        />
        {totalCount > 0 && hasListFilters && hiddenCount > 0 ? (
          <p className="flex items-center justify-center gap-3 border-t border-border py-3 text-sm text-muted-foreground">
            <span>{t("empty.hiddenByFilters", { count: hiddenCount })}</span>
            <button
              type="button"
              onClick={handleReset}
              className="font-medium text-foreground hover:underline"
            >
              {t("empty.clearFilters")}
            </button>
          </p>
        ) : null}
        {totalCount > 0 ? (
          <DataTableFooter>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t("pageSize")}</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) =>
                  updateQuery({ limit: Number(value), page: 1 }, { resetPage: true })
                }
              >
                <SelectTrigger size="sm" className="h-8 w-[4.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DataTablePagination table={listTable} />
          </DataTableFooter>
        ) : null}
      </>
    )

  return (
    <div className="flex flex-col gap-5">
      <AbandonedCartsKpis
        rangeState={queryState}
        now={now}
        onRangeChange={onRangeChange}
      />
      <DataTableCard>
        {selectedCount > 0 ? (
          <AbandonedCartsBulkBar
            count={selectedCount}
            view={queryState.view}
            busy={bulkBusy}
            onRemind={() => void handleBulkRemind()}
            onHide={() => void runBulkHide(true)}
            onUnhide={() => void runBulkHide(false)}
            onExport={() => void handleExport()}
            onClear={selection.clear}
            banner={banner}
            onSelectMatching={() => void selectAllMatching()}
            selecting={selectingAll}
          />
        ) : (
          <AbandonedCartsToolbar
            search={searchInput}
            filters={applied.filters}
            onSearchChange={(value) => {
              setSearchInput(value)
              commitSearch(value)
            }}
            onFiltersChange={handleFiltersChange}
            onReset={handleReset}
            view={queryState.view}
            onViewChange={(view: AbandonedCartsView) => {
              // The view is part of the selection's scope, so switching it
              // leaves the other view's selection behind.
              updateQuery({ view }, { resetPage: true })
            }}
            table={listTable}
            sortBy={queryState.sortBy}
            sortDir={queryState.sortDir}
            onSortChange={(sortBy, sortDir) =>
              updateQuery({ sortBy, sortDir }, { resetPage: true })
            }
            columnLabels={
              queryState.view === "product"
                ? productColumnLabels
                : customerColumnLabels
            }
            onExport={() => void handleExport()}
            onExportOps={() => void handleExportOps()}
            exportOpsBusy={opsExporting}
            resultCount={firstLoad || error ? undefined : totalCount}
            statusCounts={statusCounts}
          />
        )}
        {tableBody}
      </DataTableCard>
      <AbandonedCartReminderSheet
        carts={remindCarts}
        open={remindCarts.length > 0}
        onOpenChange={(next) => {
          if (!next) setRemindCarts([])
        }}
      />
      <AbandonedCartsItemsSheet
        cart={itemsCart}
        open={Boolean(itemsCart)}
        onOpenChange={(next) => {
          if (!next) setItemsCart(null)
        }}
      />
    </div>
  )
}

function AbandonedCartsError() {
  const t = useTranslations("abandonedCarts")
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center">
      <p className="text-sm text-muted-foreground">{t("error")}</p>
    </div>
  )
}

function AbandonedCartsTableSkeleton() {
  return (
    <div className="p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="my-2 h-14 w-full" />
      ))}
    </div>
  )
}
