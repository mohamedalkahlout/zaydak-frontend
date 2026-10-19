"use client"

import { useEffect, useMemo, useState } from "react"
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
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import type {
  ShopCollection,
  ShopCollectionsResponse,
} from "@/features/collections/types"
import { collectionName } from "@/features/collections/lib/list/helpers"

/**
 * Picks other collections, for a COLLECTIONS source or a collection-shaped
 * exclusion. The collection being edited is filtered out: a source that names
 * itself is a loop, and the API rejects it anyway.
 */
export function CollectionPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  excludeId,
  mode = "include",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (ids: string[]) => void
  excludeId?: string
  mode?: "include" | "exclude"
}) {
  const t = useTranslations("collections.picker")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(value))
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const { data, loading } = useQuery<ShopCollectionsResponse>(
    GET_SHOP_COLLECTIONS,
    {
      variables: { page: 1, limit: 50, search: debounced || undefined },
      skip: !open,
      fetchPolicy: "cache-and-network",
    },
  )

  const rows = useMemo<ShopCollection[]>(
    () =>
      (data?.collections?.data ?? []).filter(
        (collection) => collection.id !== excludeId,
      ),
    [data, excludeId],
  )

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
        className="grid-rows-[auto_auto_1fr_auto] h-[min(70vh,560px)] gap-0 p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>
            {mode === "exclude" ? t("excludeCollections") : t("addCollections")}
          </DialogTitle>
        </DialogHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder={t("searchCollections")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading && rows.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("noCollections")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((collection) => (
                <li key={collection.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-muted/50">
                    <Checkbox
                      checked={selected.has(collection.id)}
                      onCheckedChange={() => toggle(collection.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {collectionName(collection.name) || collection.slug}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("productCount", { count: collection.product_count })}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
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
