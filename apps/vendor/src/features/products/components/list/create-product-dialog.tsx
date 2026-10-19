"use client"

import { useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronRightIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog"
import {
  PRODUCT_KIND_META,
  productKindToParam,
  type ProductKind,
} from "@/features/products/lib/list/product-kind-meta"

interface CreateProductDialogProps {
  /**
   * The element that opens the picker. Omit it and drive `open` instead when
   * the trigger is not an element this can render into — the dashboard home's
   * onboarding tile is the whole card, and its click target is a stretched
   * pseudo-element on the title link, not a node to hand over here.
   */
  trigger?: React.ReactElement
  /** Controlled open state; leave both out for the self-managed default. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * "What kind of product?" picker — the products list mirror of
 * `CreateCouponDialog`. Every choice lands on the same `/products/new`
 * form; the kind rides along as `?kind=` and seeds the form's defaults
 * (see `productFormDefaults`), so the merchant never has to undo a
 * shipping card on a download or hunt for the variants editor.
 */
export function CreateProductDialog({
  trigger,
  open: openProp,
  onOpenChange,
}: CreateProductDialogProps) {
  const t = useTranslations("products.kinds")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const listRef = useRef<HTMLUListElement>(null)

  const hrefFor = (kind: ProductKind) =>
    `/store/${params?.shopSlug}/products/new?kind=${productKindToParam(kind)}`

  const handleSelect = (kind: ProductKind) => {
    setOpen(false)
    router.push(hrefFor(kind))
  }

  // The form route is a heavy client bundle; warming it on hover/focus
  // means the merchant lands on fields rather than a loading state.
  const prefetch = (kind: ProductKind) => router.prefetch(hrefFor(kind))

  // Roving arrow-key navigation. Tab already reaches every row, but in a
  // short list of sibling actions up/down is what people reach for.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-kind]") ??
        [],
    )
    if (rows.length === 0) return
    event.preventDefault()
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    const delta = event.key === "ArrowDown" ? 1 : -1
    const next = (current + delta + rows.length) % rows.length
    rows[current === -1 ? 0 : next]?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ul
          ref={listRef}
          onKeyDown={handleKeyDown}
          className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
        >
          {PRODUCT_KIND_META.map((meta) => {
            const Icon = meta.icon
            return (
              <li key={meta.value}>
                <button
                  type="button"
                  data-kind={meta.value}
                  onClick={() => handleSelect(meta.value)}
                  onMouseEnter={() => prefetch(meta.value)}
                  onFocus={() => prefetch(meta.value)}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground transition-colors group-hover:bg-background group-focus-visible:bg-background">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {t(`${meta.value}.label`)}
                      </span>
                      {meta.badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] leading-tight font-medium text-muted-foreground group-hover:bg-background">
                          {t("mostCommon")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t(`${meta.value}.description`)}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </button>
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm">
                {tCommon("cancel")}
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
