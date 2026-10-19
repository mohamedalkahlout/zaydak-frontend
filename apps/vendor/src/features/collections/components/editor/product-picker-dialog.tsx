"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "@/shared/components/app-image"
import { useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import { BanIcon, SearchIcon } from "lucide-react"
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
import { GET_PRODUCTS } from "@/features/products/api"
import type { Product, ProductsResponse } from "@/features/products/types"
import { formatMoneyCents, translatable } from "@/shared/lib/format"

/**
 * "Add products" / "Exclude products". Selection is staged in the dialog and
 * only handed back on Add — closing it changes nothing, which is what lets the
 * editor keep one save point for the whole screen.
 */
export function ProductPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  mode = "include",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (ids: string[]) => void
  mode?: "include" | "exclude"
}) {
  const t = useTranslations("collections.picker")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))

  // Re-seed from the committed value each time it opens. Adjusting state
  // during render rather than in an effect keeps the compiler rules happy and
  // avoids a frame showing the previous selection.
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

  const products = useMemo<Product[]>(() => data?.products?.data ?? [], [data])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid-rows-[auto_auto_1fr_auto] h-[min(80vh,640px)] gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>
            {mode === "exclude" ? t("excludeProducts") : t("addProducts")}
          </DialogTitle>
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
              <p>{t("noProducts")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {products.map((product) => {
                const name = translatable(product.name)
                const thumb =
                  product.image?.thumbnail ?? product.image?.original
                const price = product.sale_price_cents ?? product.price_cents
                return (
                  <li key={product.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-muted/50">
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggle(product.id)}
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
                          {name || product.slug}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoneyCents(price)}
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
            {t("selected", { count: selected.size })}
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
              onClick={() => {
                onConfirm([...selected])
                onOpenChange(false)
              }}
            >
              {t("add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
