"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ChevronsUpDownIcon, PackageIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@repo/ui/lib/utils"
import Image from "@/shared/components/app-image"
import { GET_PRODUCTS } from "@/features/products/api"
import type { ProductsResponse } from "@/features/products/types"
import type { ReviewProductFilter } from "@/features/reviews/types"
import { productFilterFromProduct } from "@/features/reviews/lib/reviews"

/** Rows one search returns. Enough to pick from — the box narrows the rest. */
const LIMIT = 20

/** How long typing settles before a search is sent. */
const DEBOUNCE_MS = 250

interface ProductFilterProps {
  value: ReviewProductFilter | null
  onChange: (product: ReviewProductFilter | null) => void
}

/**
 * The toolbar's product filter: one product, or none.
 *
 * A fresh control rather than one of the three product-picker dialogs
 * (collections, coupons, draft orders). Those stage a multi-select and hand a
 * list back on Add, which is the wrong shape for a filter — a filter takes
 * effect on the click and only ever holds one product. So this is a popover
 * combobox over `products`, searched by the server. `shouldFilter={false}` is
 * load-bearing: cmdk would otherwise match the typed text against each row's
 * `value` (the product id) and hide every result the server just returned.
 *
 * The selection is the whole `ReviewProductFilter` — label and thumbnail
 * included — so the trigger renders it with no second lookup, and so a row's
 * "show only this product" can seed it from the review it already holds.
 */
export function ProductFilter({ value, onChange }: ProductFilterProps) {
  const t = useTranslations("reviews")
  const [open, setOpen] = useState(false)
  // `search` is what the box shows; `debounced` is what the query ran with.
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // Every open starts on the unsearched list. Both halves are reset here
    // rather than left to the timer so the first query goes out at once
    // instead of a debounce later.
    if (next) {
      setSearch("")
      setDebounced("")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading } = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: {
      filters: {
        limit: LIMIT,
        sort_by: "NEWEST",
        ...(debounced ? { search: debounced } : {}),
      },
    },
    // Nothing is fetched until the merchant opens the list.
    skip: !open,
    fetchPolicy: "cache-and-network",
  })
  const products = data?.products?.data ?? []

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 max-w-64 justify-between gap-2 font-normal"
              aria-label={t("filters.product")}
            >
              {value ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <ProductThumb src={value.image} px={16} />
                  <span className="truncate">{value.label || value.id}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("filters.allProducts")}
                </span>
              )}
              <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent className="w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("filters.searchProducts")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading && products.length === 0 ? (
                <div className="flex flex-col gap-1 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>{t("filters.noProducts")}</CommandEmpty>
                  {products.map((product) => {
                    const option = productFilterFromProduct(product)
                    return (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        data-checked={product.id === value?.id}
                        onSelect={() => {
                          onChange(option)
                          setOpen(false)
                        }}
                      >
                        <ProductThumb src={option.image} px={24} />
                        <span className="truncate">{option.label}</span>
                      </CommandItem>
                    )
                  })}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("filters.clearProduct")}
          onClick={() => onChange(null)}
        >
          <XIcon className="size-4" />
        </Button>
      )}
    </div>
  )
}

/** The product's picture at chip size, or the package glyph when it has none. */
function ProductThumb({ src, px }: { src: string | null; px: 16 | 24 }) {
  const size = px === 16 ? "size-4" : "size-6"
  if (!src) {
    return (
      <PackageIcon className={cn("shrink-0 text-muted-foreground", size)} />
    )
  }
  return (
    <Image
      src={src}
      alt=""
      width={px}
      height={px}
      className={cn("shrink-0 rounded-sm object-cover", size)}
      // Catalogue hosts are whatever the importer stored; the optimizer would
      // need a `remotePatterns` entry for each.
      unoptimized
    />
  )
}
