"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
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
  ORDER_UNAPPLIED_PAYMENTS,
  REFUND_UNAPPLIED_PAYMENT,
} from "@/features/orders/api"
import type {
  Order,
  OrderUnappliedPayment,
  OrderUnappliedPaymentsResponse,
  RefundUnappliedPaymentResponse,
} from "@/features/orders/types"
import { formatDate, formatMoneyCents } from "@/features/orders/lib/list/format"
import {
  canCheckAgain,
  canRefundUnappliedPayment,
  needsCancelFirst,
  refundErrorKey,
  refusalKey,
  unappliedReasonKey,
} from "@/features/orders/lib/detail/unapplied-payments"

const money = (p: OrderUnappliedPayment) =>
  formatMoneyCents(p.amount_cents, p.currency)

/**
 * "Payments not applied to this order": card payments the order never took —
 * paid after it was closed, for a different amount, or a second time — and
 * the action that gives each one back.
 *
 * This is what the "Refund needed" badge (`payment-mismatch`) is about, and a
 * duplicate charge on a paid order lands here too. The refund MOVES MONEY, so
 * it is confirmed in a dialog quoting the **server's** amount; the server makes
 * it idempotent and leaves the order, its totals and the shop's balance alone.
 * No save bar: nothing is staged, each refund is its own confirmed action.
 *
 * Read through its own query rather than the order detail fragment: the card
 * refetches it alone after a refund or a "Check again", and a failure here
 * costs this card and not the order page. A failure is this card's to show:
 * a retry where the badge says money is owed, nothing otherwise.
 */
export function OrderUnappliedPaymentsCard({ order }: { order: Order }) {
  const t = useTranslations("orders.unappliedPayments")
  const tCommon = useTranslations("common")
  const [confirming, setConfirming] = useState<OrderUnappliedPayment | null>(
    null,
  )
  const [busyId, setBusyId] = useState<string | null>(null)

  // Only a card payment can arrive unapplied; nothing to ask otherwise.
  const isCard = order.payment.gateway?.toUpperCase() === "STRIPE"
  // `silentErrors`: this card owns its failure (a retry, or nothing), so the
  // error link must not toast it a second time over the card's own retry.
  const { data, error, refetch } = useQuery<OrderUnappliedPaymentsResponse>(
    ORDER_UNAPPLIED_PAYMENTS,
    {
      variables: { id: order.id },
      skip: !isCard,
      fetchPolicy: "cache-and-network",
      context: { silentErrors: true },
    },
  )

  const [refund] = useMutation<RefundUnappliedPaymentResponse>(
    REFUND_UNAPPLIED_PAYMENT,
    {
      refetchQueries: [
        { query: ORDER_UNAPPLIED_PAYMENTS, variables: { id: order.id } },
        { query: GET_ORDER_BY_ID, variables: { id: order.id } },
        { query: GET_ORDERS },
      ],
      awaitRefetchQueries: true,
    },
  )

  if (!isCard) return null
  if (error) {
    // A failure is worth a word only where the badge says money is owed.
    if (order.payment.status !== "payment-mismatch") return null
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent role="alert" className="flex flex-col gap-2 text-sm">
          <p>{t("loadFailed")}</p>
          <Button
            className="self-start"
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
          >
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const payments = data?.order?.data?.unapplied_payments ?? []
  if (payments.length === 0) return null

  const run = async (payment: OrderUnappliedPayment) => {
    if (busyId) return
    setBusyId(payment.id)
    try {
      const res = await refund({
        variables: { payment_intent_id: payment.id },
      })
      const after = res.data?.refundUnappliedPayment?.data
      if (after?.refund_status === "succeeded") {
        sileo.success({ title: t("success") })
      } else if (after?.refund_status === "pending") {
        sileo.success({ title: t("sent") })
      } else {
        sileo.error({
          title: t("failed"),
          description: (after && statusText(t, after)) ?? undefined,
        })
      }
      setConfirming(null)
    } catch (err) {
      sileo.error({ title: t("failed"), description: t(refusalKey(err)) })
      setConfirming(null)
      // Only the server knows where the refund stands now.
      void refetch()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {payments.map((p) => (
          <PaymentRow
            key={p.id}
            order={order}
            payment={p}
            busy={busyId === p.id}
            onRefund={() => setConfirming(p)}
            onCheckAgain={() => void run(p)}
          />
        ))}
        <p className="text-xs text-muted-foreground">{t("balanceNote")}</p>
      </CardContent>

      <Dialog
        open={!!confirming}
        onOpenChange={(open) => {
          if (!open && !busyId) setConfirming(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("confirmTitle", {
                amount: confirming ? money(confirming) : "",
              })}
            </DialogTitle>
            <DialogDescription>{t("confirmDescription")}</DialogDescription>
          </DialogHeader>

          <ul className="flex list-disc flex-col gap-1 ps-4 text-sm text-muted-foreground">
            <li>{t("effectOrder")}</li>
            <li>{t("effectBalance")}</li>
            <li>{t("effectCustomer")}</li>
          </ul>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={!!busyId}
              onClick={() => setConfirming(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              disabled={!!busyId}
              onClick={() => {
                if (confirming) void run(confirming)
              }}
            >
              {busyId ? t("refunding") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PaymentRow({
  order,
  payment,
  busy,
  onRefund,
  onCheckAgain,
}: {
  order: Order
  payment: OrderUnappliedPayment
  busy: boolean
  onRefund: () => void
  onCheckAgain: () => void
}) {
  const t = useTranslations("orders.unappliedPayments")
  const reason = unappliedReasonKey(payment.reason)
  const amount = money(payment)

  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{t(`reason.${reason}`)}</p>
        <span className="shrink-0 font-medium tabular-nums">{amount}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(`body.${reason}`, {
          amount,
          date: formatDate(payment.paid_at),
          total: formatMoneyCents(order.pricing.total_cents),
        })}
      </p>

      <StatusLine payment={payment} />

      {canRefundUnappliedPayment(order, payment) && (
        <Button className="mt-2" size="sm" disabled={busy} onClick={onRefund}>
          {t("refund", { amount })}
        </Button>
      )}
      {canCheckAgain(payment) && (
        <Button
          className="mt-2"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onCheckAgain}
        >
          {busy ? t("checking") : t("checkAgain")}
        </Button>
      )}
      {needsCancelFirst(order, payment) && (
        <p className="mt-2 text-xs font-medium">{t("closeFirst")}</p>
      )}
    </div>
  )
}

type Translate = ReturnType<typeof useTranslations<"orders.unappliedPayments">>

/** Where the refund stands, in a sentence; null before one was asked for. */
function statusText(t: Translate, payment: OrderUnappliedPayment): string | null {
  const amount = money(payment)
  switch (payment.refund_status) {
    case "requested":
      return payment.refund_error === "unconfirmed"
        ? t("error.unconfirmed")
        : t("status.requested")
    case "pending":
      return t("status.pending", { amount })
    case "succeeded":
      return t("status.succeeded", {
        amount,
        date: formatDate(payment.refunded_at ?? payment.paid_at),
      })
    case "failed":
      return t("status.failed", {
        reason: t(refundErrorKey(payment.refund_error)),
      })
    default:
      return null
  }
}

function StatusLine({ payment }: { payment: OrderUnappliedPayment }) {
  const t = useTranslations("orders.unappliedPayments")
  const text = statusText(t, payment)
  if (!text) return null
  return (
    <p
      role="status"
      className={
        payment.refund_status === "failed"
          ? "mt-1 text-xs text-destructive"
          : "mt-1 text-xs text-muted-foreground"
      }
    >
      {text}
    </p>
  )
}
