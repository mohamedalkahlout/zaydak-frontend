"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowUpDownIcon, ListFilterIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import type {
  ReviewProductFilter,
  ReviewRating,
  ShopReviewSort,
} from "@/features/reviews/types"
import { RATING_VALUES, SORT_VALUES } from "@/features/reviews/lib/reviews"
import { ProductFilter } from "./product-filter"

interface ReviewsToolbarProps {
  /** The raw input value — the query itself is throttled by the screen. */
  search: string
  onSearchChange: (value: string) => void
  rating: ReviewRating | null
  onRatingChange: (rating: ReviewRating | null) => void
  product: ReviewProductFilter | null
  onProductChange: (product: ReviewProductFilter | null) => void
  sort: ShopReviewSort
  onSortChange: (sort: ShopReviewSort) => void
  hasFilters: boolean
  onClear: () => void
}

export function ReviewsToolbar({
  search,
  onSearchChange,
  rating,
  onRatingChange,
  product,
  onProductChange,
  sort,
  onSortChange,
  hasFilters,
  onClear,
}: ReviewsToolbarProps) {
  const t = useTranslations("reviews")
  const tFilterBar = useTranslations("filterBar")
  const [pickingProduct, setPickingProduct] = useState(false)
  const hasChips = rating != null || product != null || pickingProduct

  return (
    <DataTableToolbar
      search={
        <DataTableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={t("filters.searchPlaceholder")}
        />
      }
      addFilter={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                aria-label={tFilterBar("addFilter")}
              >
                <ListFilterIcon className="size-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{tFilterBar("addFilter")}</DropdownMenuLabel>
              {rating == null ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {t("filters.rating")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    align="start"
                    side="inline-end"
                    className="min-w-40"
                  >
                    {RATING_VALUES.map((value) => (
                      <DropdownMenuItem
                        key={value}
                        onClick={() => onRatingChange(value)}
                      >
                        {t("filters.starsWithCount", { rating: value })}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              {product == null ? (
                <DropdownMenuItem onClick={() => setPickingProduct(true)}>
                  {t("filters.product")}
                </DropdownMenuItem>
              ) : null}
              {rating != null && product != null ? (
                <div className="px-1.5 py-2 text-sm text-muted-foreground">
                  {tFilterBar("noFiltersLeft")}
                </div>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      trailing={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                aria-label={t("filters.sort")}
              >
                <ArrowUpDownIcon className="size-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSortChange(value as ShopReviewSort)}
            >
              {SORT_VALUES.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(`filters.sortBy.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        hasChips ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {rating != null ? (
              <span className="inline-flex h-7 items-center overflow-hidden rounded-md bg-muted/60 text-sm ring-1 ring-foreground/10">
                <span className="px-2">{t("filters.rating")}</span>
                <span className="text-muted-foreground">{tFilterBar("is")}</span>
                <span className="px-2">
                  {t("filters.starsWithCount", { rating })}
                </span>
                <button
                  type="button"
                  aria-label={t("filters.clear")}
                  onClick={() => onRatingChange(null)}
                  className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ) : null}
            {product != null || pickingProduct ? (
              <ProductFilter
                value={product}
                onChange={(next) => {
                  onProductChange(next)
                  if (next) setPickingProduct(false)
                }}
              />
            ) : null}
          </div>
        ) : null
      }
      onClear={() => {
        setPickingProduct(false)
        onClear()
      }}
      isFiltered={hasFilters || pickingProduct}
    />
  )
}
