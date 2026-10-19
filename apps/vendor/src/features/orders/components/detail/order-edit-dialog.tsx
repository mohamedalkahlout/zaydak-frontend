"use client"

import { useMemo, useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  AlertCircleIcon,
  CreditCardIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Textarea } from "@repo/ui/components/textarea"
import { EDIT_ORDER, GET_ORDERS, GET_ORDER_BY_ID } from "@/features/orders/api"
import type {
  EditOrderResponse,
  Order,
  OrderProduct,
} from "@/features/orders/types"
import { translatable } from "@/shared/lib/format"
import { formatMoneyCents } from "@/features/orders/lib/list/format"
import {
  DraftProductPicker,
  type PickedProduct,
} from "@/features/orders/components/drafts/draft-product-picker"

export interface EditableLineItem {
  id?: string
  product_id: string
  name: string | { en?: string; ar?: string } | null
  image?: { thumbnail?: string; original?: string } | null
  unit_price_cents: number
  order_quantity: number
  fulfilled_quantity: number
  variation_option_id?: string | null
  variation_title?: string | { en?: string; ar?: string } | null
  isNew?: boolean
}

export function OrderEditDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("orders")
  const tCommon = useTranslations("common")
  const [lines, setLines] = useState<EditableLineItem[]>([])
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<number>(0)
  const [reason, setReason] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)

  // Re-seed lines & delivery fee when dialog opens or order changes
  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    orderId: string
  } | null>(null)

  if (!seededFrom || seededFrom.open !== open || seededFrom.orderId !== order.id) {
    setSeededFrom({ open, orderId: order.id })
    if (open) {
      setLines(
        order.products.map((p) => ({
          id: p.id,
          product_id: p.product_id,
          name: p.name,
          image: p.image,
          unit_price_cents: p.unit_price_cents,
          order_quantity: p.order_quantity,
          fulfilled_quantity: p.fulfilled_quantity ?? 0,
          variation_option_id: p.variation_option_id ?? null,
          variation_title: p.variation_title,
          isNew: false,
        })),
      )
      setDeliveryFeeCents(order.pricing.delivery_fee_cents ?? 0)
      setReason("")
      setPickerOpen(false)
    }
  }

  const [editOrderMutation, { loading: saving }] =
    useMutation<EditOrderResponse>(EDIT_ORDER, {
      refetchQueries: [
        { query: GET_ORDER_BY_ID, variables: { id: order.id } },
        { query: GET_ORDERS },
      ],
      awaitRefetchQueries: true,
      onCompleted: () => {
        sileo.success({ title: t("edit.success") })
        onOpenChange(false)
      },
      onError: (err) => {
        sileo.error({
          title: t("edit.failed"),
          description: err.message,
        })
      },
    })

  // Live calculations
  const {
    newSubtotalCents,
    newTaxCents,
    discountCents,
    newTotalCents,
    deltaCents,
    hasChanges,
    canSubmit,
  } = useMemo(() => {
    let subtotal = 0
    let totalQuantity = 0

    for (const l of lines) {
      subtotal += l.unit_price_cents * l.order_quantity
      totalQuantity += l.order_quantity
    }

    // Preserve the tax proportion from the original order if present
    const origSubtotal = order.pricing.subtotal_cents || 1
    const origTax = order.pricing.tax_cents ?? 0
    const effectiveTaxRate = origTax > 0 ? origTax / origSubtotal : 0.15
    const discount = Math.min(order.pricing.discount_cents ?? 0, subtotal)
    const taxable = Math.max(0, subtotal - discount)
    const tax = origTax > 0 ? Math.round(taxable * effectiveTaxRate) : 0
    const total = Math.max(0, subtotal + tax + deliveryFeeCents - discount)
    const delta = total - order.pricing.total_cents

    // Compare with initial state to see if anything changed
    const initialLinesMap = new Map(order.products.map((p) => [p.id, p.order_quantity]))
    const feeChanged = deliveryFeeCents !== (order.pricing.delivery_fee_cents ?? 0)
    let linesChanged = lines.length !== order.products.length

    if (!linesChanged) {
      for (const l of lines) {
        if (!l.id || initialLinesMap.get(l.id) !== l.order_quantity) {
          linesChanged = true
          break
        }
      }
    }

    const changed = linesChanged || feeChanged
    const valid = changed && totalQuantity > 0

    return {
      newSubtotalCents: subtotal,
      newTaxCents: tax,
      discountCents: discount,
      newTotalCents: total,
      deltaCents: delta,
      hasChanges: changed,
      canSubmit: valid,
    }
  }, [lines, deliveryFeeCents, order])

  const handleQuantityChange = (index: number, newQty: number) => {
    setLines((prev) => {
      const next = [...prev]
      const line = next[index]
      if (!line) return prev
      // Quantities cannot drop below already fulfilled items
      const clamped = Math.max(line.fulfilled_quantity, newQty)
      next[index] = { ...line, order_quantity: clamped }
      return next
    })
  }

  const handleRemoveLine = (index: number) => {
    setLines((prev) => {
      const line = prev[index]
      if (!line || line.fulfilled_quantity > 0) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleAddPickedProducts = (picked: PickedProduct[]) => {
    setLines((prev) => {
      const existingProductIds = new Set(prev.map((l) => l.product_id))
      const toAdd: EditableLineItem[] = []

      for (const p of picked) {
        if (!existingProductIds.has(p.product_id)) {
          toAdd.push({
            product_id: p.product_id,
            name: p.name,
            image: p.image ? { thumbnail: p.image, original: p.image } : null,
            unit_price_cents: p.unit_price_cents,
            order_quantity: 1,
            fulfilled_quantity: 0,
            variation_option_id: null,
            variation_title: null,
            isNew: true,
          })
        }
      }

      return [...prev, ...toAdd]
    })
  }

  const handleSave = async () => {
    if (!canSubmit || saving) return

    const payload = {
      id: order.id,
      lines: lines.map((l) => ({
        order_product_id: l.id,
        product_id: l.product_id,
        variation_option_id: l.variation_option_id ?? undefined,
        order_quantity: l.order_quantity,
        unit_price_cents: l.unit_price_cents,
      })),
      delivery_fee_cents: deliveryFeeCents,
      reason: reason.trim() || undefined,
    }

    void editOrderMutation({
      variables: { input: payload },
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>
              {t("edit.title", { number: order.tracking_number })}
            </DialogTitle>
            <DialogDescription>{t("edit.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Line items list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  {t("edit.itemsHeading", { count: lines.length })}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  disabled={saving}
                >
                  <PlusIcon className="size-3.5 me-1" />
                  {t("edit.addItem")}
                </Button>
              </div>

              <div className="divide-y divide-border border rounded-md overflow-hidden bg-card">
                {lines.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {t("edit.empty")}
                  </div>
                ) : (
                  lines.map((line, idx) => {
                    const thumb =
                      line.image && typeof line.image === "object" && "thumbnail" in line.image
                        ? (line.image.thumbnail as string | undefined)
                        : undefined
                    const variant = line.variation_title ? translatable(line.variation_title) : null
                    const isFulfilled = line.fulfilled_quantity > 0
                    const cannotReduce = line.order_quantity <= line.fulfilled_quantity

                    return (
                      <div
                        key={line.id ?? `${line.product_id}-${idx}`}
                        className="flex items-center gap-3 p-3 text-sm"
                      >
                        {/* Thumbnail */}
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="size-full object-cover"
                              width={44}
                              height={44}
                            />
                          ) : (
                            <ImageIcon className="size-5" />
                          )}
                        </div>

                        {/* Title and details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">
                              {translatable(line.name) || line.product_id}
                            </p>
                            {line.isNew && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {t("edit.newBadge")}
                              </Badge>
                            )}
                          </div>
                          {variant && (
                            <p className="truncate text-xs text-muted-foreground">{variant}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>
                              {t("edit.each", {
                                price: formatMoneyCents(line.unit_price_cents),
                              })}
                            </span>
                            {isFulfilled && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {t("edit.alreadyShipped", {
                                  count: line.fulfilled_quantity,
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-7"
                            disabled={cannotReduce || saving}
                            onClick={() => handleQuantityChange(idx, line.order_quantity - 1)}
                            aria-label={t("edit.decrease")}
                          >
                            <MinusIcon className="size-3" />
                          </Button>
                          <span className="w-8 text-center tabular-nums font-medium text-sm">
                            {line.order_quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-7"
                            disabled={saving}
                            onClick={() => handleQuantityChange(idx, line.order_quantity + 1)}
                            aria-label={t("edit.increase")}
                          >
                            <PlusIcon className="size-3" />
                          </Button>
                        </div>

                        {/* Line subtotal */}
                        <div className="w-20 text-right tabular-nums font-medium shrink-0">
                          {formatMoneyCents(line.unit_price_cents * line.order_quantity)}
                        </div>

                        {/* Remove line */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                          disabled={isFulfilled || saving}
                          onClick={() => handleRemoveLine(idx)}
                          aria-label={
                            translatable(line.name)
                              ? t("edit.remove", { name: translatable(line.name) })
                              : t("edit.removeItem")
                          }
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Delivery fee adjustment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-delivery-fee" className="text-sm font-medium">
                  {t("edit.deliveryFeeLabel", { currency: "SAR" })}
                </Label>
                <Input
                  id="edit-delivery-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={saving}
                  value={(deliveryFeeCents / 100).toString()}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setDeliveryFeeCents(isNaN(val) ? 0 : Math.max(0, Math.round(val * 100)))
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t("edit.originalFee", {
                    amount: formatMoneyCents(order.pricing.delivery_fee_cents ?? 0),
                  })}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-reason" className="text-sm font-medium">
                  {t("edit.reason")}
                </Label>
                <Textarea
                  id="edit-reason"
                  rows={2}
                  placeholder={t("edit.reasonPlaceholder")}
                  disabled={saving}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Financial Delta & Summary Card */}
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between font-semibold text-sm border-b pb-2">
                <span>{t("edit.impact")}</span>
                <span className="tabular-nums">
                  {t("edit.original", {
                    amount: formatMoneyCents(order.pricing.total_cents),
                  })}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>{t("edit.newSubtotal")}</span>
                  <span className="tabular-nums">{formatMoneyCents(newSubtotalCents)}</span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-xs">
                    <span>{t("edit.discount")}</span>
                    <span className="tabular-nums">-{formatMoneyCents(discountCents)}</span>
                  </div>
                )}
                {newTaxCents > 0 && (
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>{t("edit.estimatedTax")}</span>
                    <span className="tabular-nums">{formatMoneyCents(newTaxCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>{t("edit.deliveryFee")}</span>
                  <span className="tabular-nums">{formatMoneyCents(deliveryFeeCents)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t text-sm">
                  <span>{t("edit.newTotal")}</span>
                  <span className="tabular-nums text-foreground">
                    {formatMoneyCents(newTotalCents)}
                  </span>
                </div>
              </div>

              {/* Dynamic Delta Notice */}
              {deltaCents > 0 && (
                <div className="flex items-start gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  <CreditCardIcon className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-semibold">
                      {t("edit.additionalCharge", {
                        amount: formatMoneyCents(deltaCents),
                      })}
                    </span>
                    <p className="mt-0.5 text-amber-600/90 dark:text-amber-300/90">
                      {t("edit.additionalChargeBody", {
                        amount: formatMoneyCents(newTotalCents),
                      })}
                    </p>
                  </div>
                </div>
              )}

              {deltaCents < 0 && (
                <div className="flex items-start gap-2.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <RotateCcwIcon className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold">
                      {t("edit.refundDue", {
                        amount: formatMoneyCents(Math.abs(deltaCents)),
                      })}
                    </span>
                    <p className="mt-0.5 text-emerald-600/90 dark:text-emerald-300/90">
                      {t("edit.refundDueBody")}
                    </p>
                  </div>
                </div>
              )}

              {deltaCents === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircleIcon className="size-3.5" />
                  <span>{t("edit.evenExchange")}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-3 flex items-center justify-end gap-2 bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit || saving}
            >
              {saving ? t("edit.saving") : t("edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog Product Picker */}
      <DraftProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingIds={new Set(lines.map((l) => l.product_id))}
        currency="SAR"
        onAdd={handleAddPickedProducts}
      />
    </>
  )
}
