"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
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
import { CREATE_REFUND, GET_ORDERS, GET_ORDER_BY_ID } from "@/features/orders/api"
import type {
  CreateRefundResponse,
  Order,
  OrderProduct,
} from "@/features/orders/types"
import { translatable } from "@/shared/lib/format"
import { formatMoneyCents } from "@/features/orders/lib/list/format"
import { estimateRefundCents } from "@/features/orders/lib/detail/fulfillment"

interface LineState {
  quantity: number
  restock: boolean
  reason: string
}

/**
 * Requests a refund for some of an order's lines.
 *
 * This creates the refund in `pending` — **no money moves here**. Approval is a
 * separate, explicitly-confirmed step on the refunds card, because approving is
 * what debits the vendor balance, restocks, and issues the real gateway refund.
 * Splitting the two means a mis-typed quantity is a rejected row, not a wire
 * transfer.
 *
 * The amount shown is an ESTIMATE and is labelled as one. We do not send an
 * `amount_cents` override: the back-end allocates the order's discount and tax
 * across the refunded lines (with a remainder correction so the parts sum
 * exactly), and a client-side figure pinned into the request is how a quote
 * drifts from the charge. The approval step shows the server's real number.
 */
export function RefundDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("orders.refundDialog")
  const tCommon = useTranslations("common")
  const [lines, setLines] = useState<Record<string, LineState>>({})
  const [note, setNote] = useState("")

  // Re-seed each time the dialog opens, keyed on `open` and `order` as the old
  // dependency list was. Adjusted during render rather than from an effect:
  // React re-runs this component immediately with the seeded lines, where an
  // effect would first paint one frame carrying the previous order's rows.
  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    order: Order
  } | null>(null)

  if (!seededFrom || seededFrom.open !== open || seededFrom.order !== order) {
    setSeededFrom({ open, order })
    if (open) {
      const seeded: Record<string, LineState> = {}
      for (const l of order.products) {
        if (l.id) seeded[l.id] = { quantity: 0, restock: true, reason: "" }
      }
      setLines(seeded)
      setNote("")
    }
  }

  const [createRefund, { loading }] = useMutation<CreateRefundResponse>(
    CREATE_REFUND,
    {
      refetchQueries: [
        { query: GET_ORDER_BY_ID, variables: { id: order.id } },
        { query: GET_ORDERS },
      ],
      awaitRefetchQueries: true,
      onCompleted: () => {
        sileo.success({
          title: t("requested"),
          description: t("requestedBody"),
        })
        onOpenChange(false)
      },
      onError: (err) =>
        sileo.error({ title: t("failed"), description: err.message }),
    }
  )

  const selected = order.products
    .filter((l) => l.id && (lines[l.id]?.quantity ?? 0) > 0)
    .map((l) => ({ line: l, state: lines[l.id!]! }))

  const totalUnits = selected.reduce((sum, s) => sum + s.state.quantity, 0)
  const estimate = estimateRefundCents(
    order,
    selected.map((s) => ({ line: s.line, quantity: s.state.quantity }))
  )

  function patch(lineId: string, next: Partial<LineState>) {
    setLines((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId]!, ...next },
    }))
  }

  function submit() {
    if (totalUnits === 0) return
    void createRefund({
      variables: {
        input: {
          order_id: order.id,
          lines: selected.map(({ line, state }) => ({
            order_product_id: line.id!,
            quantity: state.quantity,
            restock: state.restock,
            ...(state.reason.trim() && { reason: state.reason.trim() }),
          })),
          ...(note.trim() && { description: note.trim() }),
        },
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {order.products.map((l) => {
            if (!l.id) return null
            const state = lines[l.id]
            if (!state) return null
            return (
              <RefundLineRow
                key={l.id}
                line={l}
                state={state}
                onChange={(next) => patch(l.id!, next)}
              />
            )
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-note">{t("note")}</Label>
          <Textarea
            id="refund-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("notePlaceholder")}
          />
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("estimated")}</span>
            <span className="font-medium tabular-nums">
              {formatMoneyCents(estimate)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("estimateNote")}
          </p>
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
            {loading ? t("creating") : t("submit", { count: totalUnits })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RefundLineRow({
  line,
  state,
  onChange,
}: {
  line: OrderProduct
  state: LineState
  onChange: (next: Partial<LineState>) => void
}) {
  const t = useTranslations("orders.refundDialog")
  const variant = translatable(line.variation_title)

  function setQuantity(raw: string) {
    const parsed = Number.parseInt(raw, 10)
    const next = Number.isNaN(parsed) ? 0 : parsed
    // Capped at the ordered quantity. The remaining-refundable cap (this line
    // minus what earlier refunds already covered) is enforced server-side with
    // OVER_REFUND_QUANTITY — the order payload does not carry per-line refunded
    // totals, so the client cannot honestly compute it.
    onChange({ quantity: Math.min(Math.max(0, next), line.order_quantity) })
  }

  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{translatable(line.name)}</p>
          <p className="text-xs text-muted-foreground">
            {variant ? `${variant} · ` : ""}
            {t("lineMeta", {
              ordered: line.order_quantity,
              price: formatMoneyCents(line.unit_price_cents),
            })}
          </p>
        </div>
        <Input
          type="number"
          min={0}
          max={line.order_quantity}
          value={state.quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20 shrink-0 tabular-nums"
          aria-label={t("quantityLabel", { name: translatable(line.name) })}
        />
      </div>

      {state.quantity > 0 && (
        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
          <Input
            value={state.reason}
            onChange={(e) => onChange({ reason: e.target.value })}
            placeholder={t("reasonPlaceholder")}
            className="h-8 text-sm"
            aria-label={t("reasonLabel", { name: translatable(line.name) })}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={state.restock}
              onCheckedChange={(checked) => onChange({ restock: checked === true })}
            />
            {t("restock")}
          </label>
        </div>
      )}
    </div>
  )
}
