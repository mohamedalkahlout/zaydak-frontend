"use client"

import { useMemo, useState } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  type ColumnOrderState,
  type RowSelectionState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { GET_PRODUCTS } from "@/features/products/api"
import type { Product, ProductsResponse } from "@/features/products/types"
import { DataTable } from "@/shared/components/data-table/data-table"
import {
  DataTableCard,
  DataTableFooter,
} from "@/shared/components/data-table/data-table-card"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import {
  DEFAULT_SORT_BY,
  PAGE_SIZE,
  PRODUCT_COLUMN_ORDER,
  PRODUCT_COLUMN_VISIBILITY,
} from "@/features/products/lib/list/constants"
import { toProductListVariables } from "@/features/products/lib/list/query-state"
import { productColumns } from "./products-columns"
import { ProductsHeader } from "./products-header"
import { ProductsToolbar } from "./products-toolbar"
import { ProductsBulkActions } from "./products-bulk-actions"
import { ProductsEmpty } from "./products-empty"
import { ImportProductsDialog } from "./import-products-dialog"
import { useProductListQuery } from "./use-product-list-query"

export function ProductsTable() {
  const t = useTranslations("products.table")
  // `queryState` is what the rows on screen were fetched with; `shownState`
  // also carries a write that has not landed yet, and is what the toolbar
  // reads so a chip ticks the moment it is clicked. See the hook.
  const { queryState, shownState, updateQuery } = useProductListQuery()

  const { data } = useSuspenseQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: toProductListVariables(queryState),
  })

  const products = useMemo<Product[]>(() => data?.products?.data ?? [], [data])
  const meta = data?.products?.meta
  const totalCount = meta?.total ?? products.length
  const totalPages = Math.max(meta?.total_pages ?? 1, 1)
  const currentPage = Math.min(
    Math.max(meta?.page ?? queryState.page, 1),
    totalPages,
  )
  const pageSize = meta?.limit ?? PAGE_SIZE

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  // Column layout and row height are how this vendor wants to read the list,
  // not what the list is — so they stay in component state and out of the URL,
  // which a row link carries into the editor and back.
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([
    ...PRODUCT_COLUMN_ORDER,
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    PRODUCT_COLUMN_VISIBILITY,
  )
  const [dense, setDense] = useState(false)
  // Owned here rather than by the header: the empty state opens the same
  // dialog, and one mount is one dialog whichever button asked for it.
  const [importOpen, setImportOpen] = useState(false)

  const table = useReactTable({
    data: products,
    columns: productColumns,
    state: {
      rowSelection,
      columnOrder,
      columnVisibility,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize,
      },
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: totalPages,
    autoResetPageIndex: false,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (
      updater: Updater<{ pageIndex: number; pageSize: number }>,
    ) => {
      const nextPagination =
        typeof updater === "function"
          ? updater({ pageIndex: currentPage - 1, pageSize })
          : updater

      if (nextPagination.pageIndex !== currentPage - 1) {
        updateQuery({ page: nextPagination.pageIndex + 1 })
      }
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilters =
    !!queryState.search ||
    !!queryState.statuses?.length ||
    !!queryState.product_types?.length ||
    !!queryState.sale_types?.length ||
    !!queryState.stock_statuses?.length ||
    !!queryState.collection_ids?.length ||
    !!queryState.tag_ids?.length ||
    !!queryState.system_category_id
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const selectedCount = selectedRows.length
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = totalCount === 0 ? 0 : pageStart + products.length - 1
  // Not `totalCount === 0` alone: under a filter that is the filtered total,
  // and a search with no matches must not strip a populated shop's header.
  const isEmptyCatalog = totalCount === 0 && !hasFilters
  const openImport = () => setImportOpen(true)

  // One return for both the populated and the empty catalogue. The empty
  // state renders inside the same card, under the same toolbar, so an empty
  // shop is the same screen with nothing in it rather than a different one —
  // and the toolbar keeps its place in the tree, so a search typed into it
  // does not lose focus when the first result flips `hasFilters`.
  return (
    <div className="flex flex-col gap-4">
      <ProductsHeader
        totalCount={totalCount}
        showActions={!isEmptyCatalog}
        onImportClick={openImport}
      />

      {/* `@container` lets the empty row lay out against the card's width,
          which with the sidebar open is not the viewport's. */}
      <DataTableCard className="@container">
        {selectedCount > 0 ? (
          <ProductsBulkActions table={table} selectedRows={selectedRows} />
        ) : (
          <ProductsToolbar
            table={table}
            queryState={shownState}
            updateQuery={updateQuery}
            sortBy={shownState.sort_by ?? DEFAULT_SORT_BY}
            dense={dense}
            onSortByChange={(sort_by) =>
              updateQuery({ sort_by }, { resetPage: true })
            }
            onDenseChange={setDense}
            onReset={() =>
              updateQuery(
                {
                  page: 1,
                  search: undefined,
                  statuses: undefined,
                  product_types: undefined,
                  sale_types: undefined,
                  stock_statuses: undefined,
                  collection_ids: undefined,
                  tag_ids: undefined,
                  system_category_id: undefined,
                },
                { resetPage: true },
              )
            }
          />
        )}
        {isEmptyCatalog ? (
          <ProductsEmpty onImportClick={openImport} />
        ) : (
          <>
            <DataTable
              table={table}
              dense={dense}
              emptyState={hasFilters ? <ProductsEmpty hasFilters /> : undefined}
            />

            {totalPages > 1 && (
              <DataTableFooter>
                <p className="text-xs text-muted-foreground">
                  {t.rich("showing", {
                    start: pageStart,
                    end: pageEnd,
                    total: totalCount,
                    b: (chunks) => (
                      <span className="font-medium text-foreground">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
                <DataTablePagination table={table} />
              </DataTableFooter>
            )}
          </>
        )}
      </DataTableCard>

      {/* Rendered outside any menu: an item unmounts with the menu on click,
          and a dialog whose trigger is gone closes with it. Mounted once so
          the header's Import and the empty state's open the same dialog. */}
      <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
