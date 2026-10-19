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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { UPDATE_ORDER } from "@/features/orders/api"
import { GET_ORDERS, GET_ORDER_BY_ID } from "@/features/orders/api"
import type {
  Order,
  OrderStatus,
  UpdateOrderResponse,
} from "@/features/orders/types"
import { orderStatusKey } from "@/features/orders/lib/list/status-labels"
import {
  isTerminalStatus,
  nextStatuses,
} from "@/features/orders/lib/list/status-transitions"
import {
  cancelRefusalKey,
  isPaidCardOrder,
} from "@/features/orders/lib/detail/cancel"
import { validationMessage } from "@/shared/lib/validation-errors"

/**
 * "Update status" on the order screen.
 *
 * Every transition goes through `updateOrder`, the merchant's own write path,
 * **cancellation included**: `cancelOrder` serves the order's customer and
 * admins and refused every merchant, so "Mark as cancelled" used to fail on
 * this screen. A cancellation is the one transition that cannot be undone and
 * gives back stock, coupon slots and wallet credit, so it alone is behind a
 * confirm. The server refuses a merchant's cancel of a card order whose
 * payment it took (`REFUND_CARD_PAYMENT_FIRST`) — nothing in a cancellation
 * refunds the card — and the dialog says so up front when the order reads as
 * one (`isPaidCardOrder`); the refund is the way to close such an order.
 */
export function OrderStatusActions({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  // The status words come from the same keys the list's badge reads, so a
  // status is named once in the app; the sentences around them live under
  // `orders.statusActions`.
  const t = useTranslations("orders")
  const statusLabel = (status: OrderStatus) => {
    const key = orderStatusKey(status)
    return t.has(key) ? t(key) : status
  }

  const [updateOrder] = useMutation<UpdateOrderResponse>(UPDATE_ORDER, {
    refetchQueries: [
      { query: GET_ORDER_BY_ID, variables: { id: order.id } },
      { query: GET_ORDERS },
    ],
    awaitRefetchQueries: true,
  })

  const transition = async (target: OrderStatus) => {
    if (busy) return
    setBusy(true)
    try {
      await updateOrder({
        variables: { input: { id: order.id, order_status: target } },
      })
      sileo.success({
        title: t("statusActions.marked", { status: statusLabel(target) }),
      })
      setConfirmingCancel(false)
    } catch (err) {
      const refusal =
        target === "order-cancelled" ? cancelRefusalKey(err) : "failed"
      if (refusal === "cardPaid") {
        sileo.error({
          title: t("statusActions.failed"),
          description: t("statusActions.cancel.cardPaid"),
        })
        setConfirmingCancel(false)
      } else {
        sileo.error({
          title: t("statusActions.failed"),
          description: validationMessage(
            err,
            err instanceof Error ? err.message : undefined,
          ),
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleTransition = (target: OrderStatus) => {
    if (target === "order-cancelled") {
      setConfirmingCancel(true)
      return
    }
    void transition(target)
  }

  const targets = nextStatuses(order.order_status)

  if (isTerminalStatus(order.order_status) || targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("statusActions.terminal", {
          status: statusLabel(order.order_status).toLowerCase(),
        })}
      </p>
    )
  }

  const paidByCard = isPaidCardOrder(order)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button {...p} disabled={busy}>
              {busy
                ? t("statusActions.updating")
                : t("statusActions.updateStatus")}
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-56">
          {targets.map((target) => (
            <DropdownMenuItem
              key={target}
              variant={target === "order-cancelled" ? "destructive" : "default"}
              onClick={() => handleTransition(target)}
            >
              {t("statusActions.markAs", { status: statusLabel(target) })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={confirmingCancel}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmingCancel(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("statusActions.cancel.title", {
                tracking: order.tracking_number,
              })}
            </DialogTitle>
            <DialogDescription>
              {t("statusActions.cancel.description")}
            </DialogDescription>
          </DialogHeader>

          {paidByCard ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t("statusActions.cancel.cardPaid")}
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-muted-foreground">
              <li>{t("statusActions.cancel.effectStock")}</li>
              <li>{t("statusActions.cancel.effectCustomer")}</li>
            </ul>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmingCancel(false)}
            >
              {t("statusActions.cancel.keep")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || paidByCard}
              onClick={() => void transition("order-cancelled")}
            >
              {busy
                ? t("statusActions.cancel.cancelling")
                : t("statusActions.cancel.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
