"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"
import type {
  Product,
  ProductSortBy,
  ProductStatus,
} from "@/features/products/types"
import { PRODUCT_VIEWS } from "@/features/products/lib/list/constants"
import {
  activeFilterKeys,
  filterPatch,
  filterValuesOf,
  findFilterKey,
  type ProductFilterKeyId,
} from "@/features/products/lib/list/filters"
import type { ProductListQueryState } from "@/features/products/lib/list/query-state"
import { ProductsFilterBar } from "./filter-bar/products-filter-bar"
import { ProductsAddFilter } from "./filter-bar/products-add-filter"
import { ProductsViewOptions } from "./products-view-options"
import { useThrottledCallback } from "@/shared/hooks/use-throttled-callback"

interface ProductsToolbarProps {
  table: Table<Product>
  queryState: ProductListQueryState
  updateQuery: (
    patch: Partial<ProductListQueryState>,
    opts?: { resetPage?: boolean },
  ) => void
  onReset: () => void
  sortBy: ProductSortBy
  dense: boolean
  onSortByChange: (value: ProductSortBy) => void
  onDenseChange: (value: boolean) => void
}

export function ProductsToolbar({
  table,
  queryState,
  updateQuery,
  onReset,
  sortBy,
  dense,
  onSortByChange,
  onDenseChange,
}: ProductsToolbarProps) {
  const t = useTranslations("products.list")
  const statuses = queryState.statuses
  const view = statuses?.length === 1 ? statuses[0]! : "ALL"
  const applied = activeFilterKeys(queryState)
  const usedFields = new Set(applied.map((key) => key.id))
  const [startKey, setStartKey] = useState<{
    id: ProductFilterKeyId
    nonce: number
  } | null>(null)
  const [searchInput, setSearchInput] = useState(queryState.search ?? "")
  const [seededFrom, setSeededFrom] = useState(queryState.search ?? "")
  // The last value this box pushed to the URL. State rather than a ref because
  // render reads it: a URL change that merely echoes our own commit must not
  // overwrite what the user has typed since.
  const [lastApplied, setLastApplied] = useState(queryState.search ?? "")
  const urlSearch = queryState.search ?? ""
  if (urlSearch !== seededFrom) {
    setSeededFrom(urlSearch)
    if (urlSearch !== lastApplied) {
      setSearchInput(urlSearch)
    }
  }

  const commitSearch = useThrottledCallback(
    (value: string) => {
      const next = value.trim()
      setLastApplied(next)
      updateQuery({ search: next || undefined }, { resetPage: true })
    },
    300,
    [updateQuery],
  )

  const hasChips = applied.length > 0 || startKey != null
  const chips = (
    <ProductsFilterBar
      chrome
      state={queryState}
      onQueryChange={updateQuery}
      onReset={onReset}
      startKey={startKey}
      onDismissStart={() => setStartKey(null)}
    />
  )

  return (
    <DataTableToolbar
      leading={
        <DataTableViewTabs aria-label={t("statusAria")}>
          {PRODUCT_VIEWS.map((option) => (
            <DataTableViewTab
              key={option.value}
              selected={view === option.value}
              onClick={() =>
                updateQuery(
                  {
                    statuses:
                      option.value === "ALL"
                        ? undefined
                        : [option.value as ProductStatus],
                  },
                  { resetPage: true },
                )
              }
            >
              {t(`views.${option.value}`)}
            </DataTableViewTab>
          ))}
        </DataTableViewTabs>
      }
      search={
        <DataTableSearch
          value={searchInput}
          onChange={(value) => {
            setSearchInput(value)
            commitSearch(value)
          }}
          placeholder={t("search")}
        />
      }
      addFilter={
        <ProductsAddFilter
          usedFields={usedFields}
          onPickField={(id) =>
            setStartKey((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
          }
          onPickValue={(id, value) => {
            const key = findFilterKey(id)
            if (!key) return
            const current = filterValuesOf(queryState, key)
            updateQuery(
              filterPatch(key, key.multiple ? [...current, value] : [value]),
              { resetPage: true },
            )
          }}
        />
      }
      trailing={
        <ProductsViewOptions
          table={table}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          dense={dense}
          onDenseChange={onDenseChange}
        />
      }
      filters={hasChips ? chips : null}
      onClear={onReset}
      isFiltered={
        hasChips || Boolean(queryState.search) || searchInput !== ""
      }
    />
  )
}
