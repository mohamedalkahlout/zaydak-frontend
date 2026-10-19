"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { majorToCents } from "@/shared/lib/format"

export interface CustomLineDraft {
  /** Synthetic id — not a catalog product. Prefixed `custom:`. */
  product_id: string
  variation_option_id: null
  name: string
  image: null
  unit_price_cents: number
  quantity: number
  is_custom: true
}

interface CustomItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  onAdd: (line: CustomLineDraft) => void
}

/**
 * Shopify-style custom line item. Staged locally only — draft-order APIs still
 * require a real `product_id`, so Save refuses drafts that still carry customs.
 */
export function CustomItemDialog({
  open,
  onOpenChange,
  currency,
  onAdd,
}: CustomItemDialogProps) {
  const t = useTranslations("draftOrders.form")
  const [name, setName] = useState("")
  const [priceMajor, setPriceMajor] = useState("")
  const [qty, setQty] = useState("1")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName("")
      setPriceMajor("")
      setQty("1")
    }
  }

  const nameTrimmed = name.trim()
  const priceCents = majorToCents(Number(priceMajor) || 0)
  const quantity = Math.max(1, Math.floor(Number(qty) || 1))
  const canAdd = nameTrimmed.length > 0 && priceMajor !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("customItemTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-name">{t("customItemName")}</Label>
            <Input
              id="custom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-price">{t("customItemPrice")}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {currency}
                </span>
                <Input
                  id="custom-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceMajor}
                  onChange={(e) => setPriceMajor(e.target.value)}
                  className="ps-12 tabular-nums"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-qty">{t("quantity")}</Label>
              <Input
                id="custom-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("customItemHint")}</p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              onAdd({
                product_id: `custom:${crypto.randomUUID()}`,
                variation_option_id: null,
                name: nameTrimmed,
                image: null,
                unit_price_cents: priceCents,
                quantity,
                is_custom: true,
              })
              onOpenChange(false)
            }}
          >
            {t("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
