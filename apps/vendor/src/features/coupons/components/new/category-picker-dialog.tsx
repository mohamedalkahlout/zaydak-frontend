"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { BanIcon, FolderIcon, SearchIcon } from "lucide-react"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import type { ShopCollection, ShopCollectionsResponse } from "@/features/collections/types"
import { translatable } from "@/shared/lib/format"
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

interface CategoryPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string[]
  onConfirm: (ids: string[]) => void
  maxSelection?: number
}

export function CategoryPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  maxSelection = 100,
}: CategoryPickerDialogProps) {
  const t = useTranslations("coupons")
  // The collection kind reads the words the collections screen shows for it.
  const tCollections = useTranslations("collections")
  const tCommon = useTranslations("common")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(value))
  // Reset selection to the committed `value` each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set(value))
  }

  const { data, loading } = useQuery<ShopCollectionsResponse>(
    GET_SHOP_COLLECTIONS,
    {
      variables: { page: 1, limit: 100 },
      skip: !open,
      fetchPolicy: "cache-and-network",
    },
  )

  const all: ShopCollection[] = data?.collections?.data ?? []

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter((c) => {
      const name = String(translatable(c.name) ?? "").toLowerCase()
      return name.includes(q) || c.slug.toLowerCase().includes(q)
    })
  }, [all, search])

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
          <DialogTitle>{t("collectionPicker.title")}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("collectionPicker.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {loading && visible.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <BanIcon className="size-8 stroke-[1.5]" />
              <p>{t("collectionPicker.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((c) => {
                const name = translatable(c.name)
                const checked = selected.has(c.id)
                const typeKey = `type.${c.type}`
                // A kind the server invents shows as its raw id, as before.
                const typeLabel = tCollections.has(typeKey)
                  ? tCollections(typeKey)
                  : c.type.toLowerCase()
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(c.id)}
                      />
                      <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {name || c.slug}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("counts.products", {
                            count: c.product_count ?? 0,
                          })}
                          {" · "}
                          <span className="capitalize">{typeLabel}</span>
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
            {t("collectionPicker.selected", {
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
