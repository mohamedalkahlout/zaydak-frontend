"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
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
import { FULFILL_ORDER, GET_ORDERS, GET_ORDER_BY_ID } from "@/features/orders/api"
import type {
  FulfillOrderResponse,
  Order,
  OrderProduct,
} from "@/features/orders/types"
import { translatable } from "@/shared/lib/format"
import { remainingToFulfill } from "@/features/orders/lib/detail/fulfillment"

/**
 * Ships some or all of an order's remaining units, optionally with carrier
 * tracking. Quantities are per line and default to everything remaining, which
 * makes the common case ("ship it all") a single click.
 *
 * The back-end moves real inventory here (committed down, on_hand down), so the
 * dialog never lets a line exceed what is actually left — the same cap the
 * server enforces with EXCEEDS_REMAINING.
 */
export function FulfillDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("orders.fulfillDialog")
  const tCommon = useTranslations("common")
  const fulfillable = order.products.filter((l) => remainingToFulfill(l) > 0)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingCompany, setTrackingCompany] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")

  // Re-seed every time the dialog opens: the order may have changed underneath
  // (another tab shipped a line), and stale quantities would fail the server cap.
  //
  // Adjusted during render rather than from an effect. React discards this
  // render and re-runs immediately with the seeded values, where an effect
  // would first commit a frame showing the PREVIOUS order's quantities — on a
  // screen whose whole job is entering how many units are going out.
  //
  // Keyed on `open` and `order`, matching the old dependency list. `fulfillable`
  // is derived from `order`, so keying on it directly would re-seed on every
  // render and stomp the merchant's typing.
  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    order: Order
  } | null>(null)

  if (!seededFrom || seededFrom.open !== open || seededFrom.order !== order) {
    setSeededFrom({ open, order })
    if (open) {
      const seeded: Record<string, number> = {}
      for (const l of fulfillable) {
        if (l.id) seeded[l.id] = remainingToFulfill(l)
      }
      setQuantities(seeded)
      setTrackingNumber("")
      setTrackingCompany("")
      setTrackingUrl("")
    }
  }

  const [fulfillOrder, { loading }] = useMutation<FulfillOrderResponse>(
    FULFILL_ORDER,
    {
      refetchQueries: [
        { query: GET_ORDER_BY_ID, variables: { id: order.id } },
        { query: GET_ORDERS },
      ],
      awaitRefetchQueries: true,
      onCompleted: () => {
        sileo.success({ title: t("success") })
        onOpenChange(false)
      },
      onError: (err) =>
        sileo.error({
          title: t("failed"),
          description: err.message,
        }),
    }
  )

  const lines = fulfillable
    .filter((l) => l.id && (quantities[l.id] ?? 0) > 0)
    .map((l) => ({ order_product_id: l.id!, quantity: quantities[l.id!]! }))

  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0)

  function setQuantity(lineId: string, raw: string, max: number) {
    const parsed = Number.parseInt(raw, 10)
    const next = Number.isNaN(parsed) ? 0 : parsed
    setQuantities((q) => ({ ...q, [lineId]: Math.min(Math.max(0, next), max) }))
  }

  function submit() {
    if (totalUnits === 0) return
    void fulfillOrder({
      variables: {
        input: {
          order_id: order.id,
          lines,
          ...(trackingNumber.trim() && { tracking_number: trackingNumber.trim() }),
          ...(trackingCompany.trim() && {
            tracking_company: trackingCompany.trim(),
          }),
          ...(trackingUrl.trim() && { tracking_url: trackingUrl.trim() }),
        },
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {fulfillable.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                value={l.id ? (quantities[l.id] ?? 0) : 0}
                onChange={(raw) =>
                  l.id && setQuantity(l.id, raw, remainingToFulfill(l))
                }
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tracking-number">{t("trackingNumber")}</Label>
                <Input
                  id="tracking-number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="1Z999AA10123456784"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tracking-company">{t("carrier")}</Label>
                <Input
                  id="tracking-company"
                  value={trackingCompany}
                  onChange={(e) => setTrackingCompany(e.target.value)}
                  placeholder="Aramex"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracking-url">{t("trackingUrl")}</Label>
              <Input
                id="tracking-url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={loading || totalUnits === 0}>
            {loading ? t("submitting") : t("submit", { count: totalUnits })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LineRow({
  line,
  value,
  onChange,
}: {
  line: OrderProduct
  value: number
  onChange: (raw: string) => void
}) {
  const t = useTranslations("orders.fulfillDialog")
  const max = remainingToFulfill(line)
  const variant = translatable(line.variation_title)

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{translatable(line.name)}</p>
        <p className="text-xs text-muted-foreground">
          {variant ? `${variant} · ` : ""}
          {t("lineRemaining", { remaining: max, ordered: line.order_quantity })}
        </p>
      </div>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 shrink-0 tabular-nums"
        aria-label={t("quantityLabel", { name: translatable(line.name) })}
      />
    </div>
  )
}
