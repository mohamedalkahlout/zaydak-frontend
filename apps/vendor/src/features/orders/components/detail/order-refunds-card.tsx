"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import {
  GET_ORDERS,
  GET_ORDER_BY_ID,
  UPDATE_REFUND_STATUS,
} from "@/features/orders/api"
import type {
  Order,
  OrderRefund,
  UpdateRefundStatusResponse,
} from "@/features/orders/types"
import { formatDate, formatMoneyCents } from "@/features/orders/lib/list/format"
import { canRefund } from "@/features/orders/lib/detail/fulfillment"
import { RefundDialog } from "./refund-dialog"

/**
 * Refunds and cancellations on the order, plus the two actions that act on
 * them: request a refund, and approve or reject a pending one.
 *
 * Approving is the step that MOVES MONEY — it debits the vendor balance,
 * restocks the lines flagged for it, rewinds coupon usage, and issues the real
 * Stripe refund. So it is confirmed in its own dialog that names those effects
 * and quotes the **server's** amount, never a figure the client computed.
 */
export function OrderRefundsCard({ order }: { order: Order }) {
  const t = useTranslations("orders.refunds")
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [confirming, setConfirming] = useState<OrderRefund | null>(null)

  const refunds = order.refunds ?? []
  const cancellation = order.cancellation
  const refundable = canRefund(order)

  // Nothing to show and nothing to do — stay out of the layout entirely.
  if (refunds.length === 0 && !cancellation && !refundable) return null

  // A status the server invents has no message; its raw id beats a
  // missing-message path in the badge.
  const statusLabel = (status: string) =>
    t.has(`status.${status}`) ? t(`status.${status}`) : status

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{t("title")}</CardTitle>
        {refundable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefundDialogOpen(true)}
          >
            {t("refundItems")}
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 text-sm">
        {refunds.length === 0 && !cancellation && (
          <p className="text-muted-foreground">{t("empty")}</p>
        )}

        {refunds.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {r.title ?? (r.is_partial ? t("partialRefund") : t("refund"))}
              </p>
              {r.description && (
                <p className="truncate text-xs text-muted-foreground">
                  {r.description}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {formatDate(r.created_at)}
                <Badge
                  variant={r.status === "pending" ? "outline" : "secondary"}
                  className="text-[10px]"
                >
                  {statusLabel(r.status)}
                </Badge>
              </p>

              {r.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setConfirming(r)}>
                    {t("approve")}
                  </Button>
                  <RejectButton orderId={order.id} refund={r} />
                </div>
              )}
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-orange-700">
              - {formatMoneyCents(r.amount_cents)}
            </span>
          </div>
        ))}

        {cancellation && (
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-sm font-medium">{t("cancellation")}</p>
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground tabular-nums">
              <span>
                {t("amount", {
                  amount: formatMoneyCents(cancellation.amount_cents),
                })}
              </span>
              <span>
                {t("tax", { amount: formatMoneyCents(cancellation.tax_cents) })}
              </span>
              <span>
                {t("deliveryFee", {
                  amount: formatMoneyCents(cancellation.delivery_fee_cents),
                })}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <RefundDialog
        order={order}
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
      />

      <ApproveRefundDialog
        orderId={order.id}
        refund={confirming}
        onClose={() => setConfirming(null)}
      />
    </Card>
  )
}

function useRefundStatusMutation(orderId: string) {
  return useMutation<UpdateRefundStatusResponse>(UPDATE_REFUND_STATUS, {
    refetchQueries: [
      { query: GET_ORDER_BY_ID, variables: { id: orderId } },
      { query: GET_ORDERS },
    ],
    awaitRefetchQueries: true,
  })
}

/**
 * The money step. The amount quoted here is `refund.amount_cents` as the server
 * computed it at creation — not a client-side estimate — because this dialog is
 * the last thing between the merchant and an irreversible transfer.
 */
function ApproveRefundDialog({
  orderId,
  refund,
  onClose,
}: {
  orderId: string
  refund: OrderRefund | null
  onClose: () => void
}) {
  const t = useTranslations("orders.refunds")
  const tCommon = useTranslations("common")
  const [approve, { loading }] = useRefundStatusMutation(orderId)

  function confirm() {
    if (!refund) return
    void approve({
      variables: { input: { id: refund.id, status: "approved" } },
    })
      .then(() => {
        sileo.success({ title: t("approved") })
        onClose()
      })
      .catch((err: unknown) =>
        sileo.error({
          title: t("approveFailed"),
          description: err instanceof Error ? err.message : undefined,
        })
      )
  }

  return (
    <Dialog open={!!refund} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("approveTitle", {
              amount: refund ? formatMoneyCents(refund.amount_cents) : "",
            })}
          </DialogTitle>
          <DialogDescription>{t("approveDescription")}</DialogDescription>
        </DialogHeader>

        <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-muted-foreground">
          <li>{t("effectMoney")}</li>
          <li>{t("effectBalance")}</li>
          <li>{t("effectRestock")}</li>
          <li>{t("effectCoupon")}</li>
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={confirm} disabled={loading}>
            {loading ? t("approving") : t("approveRefund")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Rejecting moves no money — it just closes the request out. No confirmation. */
function RejectButton({
  orderId,
  refund,
}: {
  orderId: string
  refund: OrderRefund
}) {
  const t = useTranslations("orders.refunds")
  const [reject, { loading }] = useRefundStatusMutation(orderId)

  function onClick() {
    void reject({ variables: { input: { id: refund.id, status: "rejected" } } })
      .then(() => sileo.success({ title: t("rejected") }))
      .catch((err: unknown) =>
        sileo.error({
          title: t("rejectFailed"),
          description: err instanceof Error ? err.message : undefined,
        })
      )
  }

  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={loading}>
      {loading ? t("rejecting") : t("reject")}
    </Button>
  )
}
