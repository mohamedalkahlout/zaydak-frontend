"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Search, ChevronDown, ChevronRight, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { cn } from "@/shared/lib/utils"
import { displayName, imageThumb } from "./transfer-helpers"

type Variant = {
  id: string
  title: Record<string, string> | string
}
export type PickerProduct = {
  id: string
  name: Record<string, string> | string
  product_type: "SIMPLE" | "VARIABLE"
  image: { thumbnail?: string } | null
  variation_options: Variant[] | null
}
export type PickItem = {
  product_id: string | null
  variation_option_id: string | null
  product_name?: Record<string, string> | string | null
  variant_title?: Record<string, string> | string | null
  image?: unknown
  sku?: string | null
}

const keyFor = (productId: string | null, variationId: string | null) =>
  `${productId ?? ""}:${variationId ?? ""}`

/**
 * Shopify's "Add products" modal. A searchable product list with per-row
 * Available-at-origin / Available-at-destination columns and checkbox
 * selection; variable products expand to selectable variant rows. Already-added
 * lines are pre-checked and locked. Confirming returns the newly chosen items.
 */
export function AddProductsDialog({
  open,
  onOpenChange,
  products,
  existingKeys,
  availOrigin,
  availDest,
  locale,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: PickerProduct[]
  existingKeys: Set<string>
  availOrigin: (item: { product_id: string | null; variation_option_id: string | null }) => number
  availDest: (item: { product_id: string | null; variation_option_id: string | null }) => number
  locale: string
  onAdd: (items: PickItem[]) => void
}) {
  const t = useTranslations("transfers.addProducts")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Map<string, PickItem>>(new Map())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      displayName(p.name, locale).toLowerCase().includes(q),
    )
  }, [products, query, locale])

  const toggle = (item: PickItem) => {
    const k = keyFor(item.product_id, item.variation_option_id)
    if (existingKeys.has(k)) return
    setPicked((m) => {
      const next = new Map(m)
      if (next.has(k)) next.delete(k)
      else next.set(k, item)
      return next
    })
  }
  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const isChecked = (k: string) => existingKeys.has(k) || picked.has(k)

  const confirm = () => {
    onAdd([...picked.values()])
    setPicked(new Map())
    setQuery("")
    onOpenChange(false)
  }
  const cancel = () => {
    setPicked(new Map())
    setQuery("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(n) => (n ? onOpenChange(n) : cancel())}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchProducts")}
                className="h-9 ps-8"
              />
            </div>
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-start font-medium">
                    {t("product")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("availableAtOrigin")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("availableAtDestination")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      {t("noProducts")}
                    </td>
                  </tr>
                )}
                {filtered.map((p) => {
                  const isVar = p.product_type === "VARIABLE"
                  const variants = p.variation_options ?? []
                  if (!isVar) {
                    const item: PickItem = {
                      product_id: p.id,
                      variation_option_id: null,
                      product_name: p.name,
                      variant_title: null,
                      image: p.image,
                      sku: null,
                    }
                    const k = keyFor(p.id, null)
                    return (
                      <ProductRow
                        key={p.id}
                        name={displayName(p.name, locale)}
                        thumb={imageThumb(p.image)}
                        checked={isChecked(k)}
                        disabled={existingKeys.has(k)}
                        origin={availOrigin(item)}
                        dest={availDest(item)}
                        onToggle={() => toggle(item)}
                      />
                    )
                  }
                  const open = expanded.has(p.id)
                  return (
                    <FragmentRows key={p.id}>
                      <tr className="border-t border-border/60">
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5" colSpan={3}>
                          <button
                            type="button"
                            onClick={() => toggleExpand(p.id)}
                            className="flex items-center gap-2 text-start font-medium"
                          >
                            {open ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
                            )}
                            {displayName(p.name, locale)}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({variants.length})
                            </span>
                          </button>
                        </td>
                      </tr>
                      {open &&
                        variants.map((v) => {
                          const item: PickItem = {
                            product_id: null,
                            variation_option_id: v.id,
                            product_name: p.name,
                            variant_title: v.title,
                            image: p.image,
                            sku: null,
                          }
                          const k = keyFor(null, v.id)
                          return (
                            <ProductRow
                              key={v.id}
                              indent
                              name={displayName(v.title, locale)}
                              thumb={imageThumb(p.image)}
                              checked={isChecked(k)}
                              disabled={existingKeys.has(k)}
                              origin={availOrigin(item)}
                              dest={availDest(item)}
                              onToggle={() => toggle(item)}
                            />
                          )
                        })}
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 p-4">
          <span className="text-sm text-muted-foreground">
            {t("variantsSelected", { count: picked.size })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={cancel}>
              {t("cancel")}
            </Button>
            <Button onClick={confirm} disabled={picked.size === 0}>
              <Plus className="size-3.5" />
              {t("add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function ProductRow({
  name,
  thumb,
  checked,
  disabled,
  origin,
  dest,
  onToggle,
  indent = false,
}: {
  name: string
  thumb: string | null
  checked: boolean
  disabled: boolean
  origin: number
  dest: number
  onToggle: () => void
  indent?: boolean
}) {
  return (
    <tr
      className={cn(
        "border-t border-border/60",
        !disabled && "cursor-pointer hover:bg-muted/30",
      )}
      onClick={() => !disabled && onToggle()}
    >
      <td className="px-3 py-2.5">
        <Checkbox checked={checked} disabled={disabled} />
      </td>
      <td className={cn("px-3 py-2.5", indent && "ps-8")}>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <span className="truncate">{name}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-end tabular-nums">{origin}</td>
      <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground">
        {dest}
      </td>
    </tr>
  )
}
