"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation } from "@apollo/client/react"
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
import {
  GET_ORDER_BY_ID,
  GET_ORDERS,
  UPDATE_ORDER,
} from "@/features/orders/api"
import type { Order, UpdateOrderResponse } from "@/features/orders/types"
import { formatMoneyCents } from "@/features/orders/lib/list/format"
import {
  SETTLED_PAYMENT_STATUS,
  canMarkOrderPaid,
} from "@/features/orders/lib/detail/payment"

/**
 * "Mark as paid" for an INVOICE order converted from a "payment due later"
 * draft, whose payment is still pending and which has no other way to reach
 * Paid. It is the `updateOrder` payment_status write, behind a confirm because
 * it records money as received and the dashboard has no undo for it. The
 * server does the rest: it refuses a paid write on a card or bank-transfer
 * order, makes the write a compare-and-set so a double click or a second tab
 * fires ORDER_PAID once (the loser succeeds quietly), and marks the order's
 * invoice paid. A refusal's message is shown in the dialog.
 *
 * Renders nothing when `canMarkOrderPaid` says the order does not qualify.
 */
export function OrderMarkPaidAction({ order }: { order: Order }) {
  const t = useTranslations("orders.settle")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [updateOrder] = useMutation<UpdateOrderResponse>(UPDATE_ORDER, {
    refetchQueries: [
      { query: GET_ORDER_BY_ID, variables: { id: order.id } },
      { query: GET_ORDERS },
    ],
    awaitRefetchQueries: true,
  })

  if (!canMarkOrderPaid(order)) return null

  const close = () => {
    if (saving) return
    setOpen(false)
    setError(null)
  }

  const confirm = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await updateOrder({
        variables: {
          input: { id: order.id, payment_status: SETTLED_PAYMENT_STATUS },
        },
      })
      sileo.success({ title: t("success") })
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t("failed")
      setError(message)
      sileo.error({ title: t("failed"), description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("markAsPaid")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description", {
                amount: formatMoneyCents(order.pricing.total_cents),
              })}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={close}>
              {t("cancel")}
            </Button>
            <Button disabled={saving} onClick={() => void confirm()}>
              {saving ? t("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
