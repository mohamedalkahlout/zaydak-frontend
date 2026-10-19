"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "@/shared/components/app-image"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { BanIcon, SearchIcon } from "lucide-react"
import { GET_PRODUCTS } from "@/features/products/api"
import type { Product, ProductsResponse } from "@/features/products/types"
import { translatable, formatMoneyCents } from "@/shared/lib/format"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Skeleton } from "@repo/ui/components/skeleton"

/** A product chosen from the picker, denormalized so the line table can render
 * without a second lookup. `unit_price_cents` is the effective price. */
export interface PickedProduct {
  product_id: string
  name: string
  image?: string | null
  unit_price_cents: number
  in_stock: boolean
}

interface DraftProductPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Product IDs already on the draft — shown checked + counted, re-adding is a no-op. */
  existingIds: Set<string>
  currency: string
  onAdd: (products: PickedProduct[]) => void
}

const MAX_VARIANTS = 500

const effectivePrice = (p: Product): number =>
  p.sale_price_cents ?? p.price_cents ?? 0

/** Shopify-style "Select products" modal for a draft order. */
export function DraftProductPicker({
  open,
  onOpenChange,
  existingIds,
  currency,
  onAdd,
}: DraftProductPickerProps) {
  const t = useTranslations("draftOrders.form")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelected(new Set())
      setSearch("")
      setDebounced("")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading } = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: {
      filters: {
        limit: 50,
        sort_by: "NEWEST",
        ...(debounced ? { search: debounced } : {}),
      },
    },
    skip: !open,
    fetchPolicy: "cache-and-network",
  })

  const products = useMemo<Product[]>(() => data?.products?.data ?? [], [data])

  const toggle = (id: string) => {
    if (existingIds.has(id)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    const byId = new Map(products.map((p) => [p.id, p]))
    const picked: PickedProduct[] = []
    for (const id of selected) {
      const p = byId.get(id)
      if (!p) continue
      picked.push({
        product_id: p.id,
        name: translatable(p.name) || p.slug,
        image: p.image?.thumbnail ?? p.image?.original ?? null,
        unit_price_cents: effectivePrice(p),
        in_stock: p.in_stock,
      })
    }
    onAdd(picked)
    onOpenChange(false)
  }

  const selectedCount = selected.size + existingIds.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl grid-rows-[auto_auto_1fr_auto] h-[min(80vh,640px)] gap-0 p-0"
        showCloseButton
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("selectProducts")}</DialogTitle>
        </DialogHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder={t("searchProducts")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading && products.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("noProductsFound")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {products.map((p) => {
                const name = translatable(p.name)
                const already = existingIds.has(p.id)
                const checked = already || selected.has(p.id)
                const thumb = p.image?.thumbnail ?? p.image?.original
                return (
                  <li key={p.id}>
                    <label
                      className={`flex items-center gap-3 px-5 py-2.5 ${already ? "cursor-default opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={already}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt={name}
                            width={40}
                            height={40}
                            className="size-10 object-cover"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {name || p.slug}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoneyCents(effectivePrice(p), currency)}
                          {already
                            ? ` · ${t("alreadyAdded")}`
                            : p.in_stock
                              ? ""
                              : ` · ${t("outOfStock")}`}
                        </p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground tabular-nums">
            {t("variantsSelected", {
              count: selectedCount,
              max: MAX_VARIANTS,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={selected.size === 0}
            >
              {t("add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
