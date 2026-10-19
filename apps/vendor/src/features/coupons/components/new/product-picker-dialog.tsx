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

interface ProductPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (ids: string[]) => void
  maxSelection?: number
}

export function ProductPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  maxSelection = 100,
}: ProductPickerDialogProps) {
  const t = useTranslations("coupons")
  const tCommon = useTranslations("common")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))
  // Reset selection to the committed `value` each time the dialog opens.
  // Derived-state-in-render avoids the `react-hooks/set-state-in-effect`
  // warning you'd get from doing this in a `useEffect`.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(value))
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

  const products = useMemo<Product[]>(
    () => data?.products?.data ?? [],
    [data],
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < maxSelection) {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selected))
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelected(new Set(value))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl grid-rows-[auto_auto_1fr_auto] h-[min(80vh,640px)] p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("productPicker.title")}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("productPicker.search")}
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
              <p>{t("productPicker.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {products.map((p) => {
                const name = translatable(p.name)
                const checked = selected.has(p.id)
                const thumb = p.image?.thumbnail ?? p.image?.original
                const price = p.sale_price_cents ?? p.price_cents
                return (
                  <li key={p.id}>
                    <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
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
                          {formatMoneyCents(price)}
                          {p.in_stock
                            ? ""
                            : ` · ${t("productPicker.outOfStock")}`}
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
          <span className="text-xs text-muted-foreground">
            {t("productPicker.selected", {
              selected: selected.size,
              max: maxSelection,
            })}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              {t("pickers.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
