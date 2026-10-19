"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@repo/ui/components/button"

import { AuthCard } from "@/features/auth/components/auth-card"
import { PAY_LINK_ORDER } from "@/features/orders/api"
import { OrderDetail } from "@/features/orders/components/order-detail"
import { isPaymentRefunded } from "@/features/orders/lib/status"
import { useShop } from "@/features/shop/shop-context"
import { formatMoney } from "@/shared/lib/format"
import { shopHomeHref } from "@/shared/lib/tenant"
import { OPEN_ORDER_PAYMENT } from "../api"

type Opening = {
  state: string
  payment_url?: string | null
  order_id: string
  tracking_number: string
  total_cents: number
  currency: string
}

/**
 * The far end of the pay link an order placed in a chat is sent.
 *
 * **It asks once, on arrival, and forwards a payable order straight to the
 * provider** — the customer tapped a link to pay, and a second tap on a
 * button in between was a step for nothing. The answer says what the order
 * needs: a payment (`PAYABLE`, with the provider's page), a moment
 * (`PROCESSING`), nothing (`PAID`), or nothing it can take (`CLOSED`). A
 * closed order whose payment was refunded says so, with the order and the
 * amount — see `closedBecauseRefunded`.
 *
 * The forward **replaces** this page in the history, so "back" from the
 * provider's page leaves rather than landing here to be forwarded again; and
 * a customer the provider sends back unpaid (`?cancelled=1`) gets the button
 * instead, because forwarding them would bounce them to the payment they just
 * left.
 *
 * **Paid, it becomes the order.** The provider sends a paid customer back
 * with `?paid=1`, and they get the storefront checkout's own ending: the
 * order screen with the "order placed" popup over it — read with the link's
 * token (`OrderDetail`'s pay-link mode), since somebody paying from a chat
 * has usually never signed in on this browser.
 *
 * No session is needed or used: the token in the path is the permission, for
 * this one order.
 */
export function OrderPayment({ token }: { token: string }) {
  const t = useTranslations("pay")
  const locale = useLocale()
  const { base } = useShop()
  const search = useSearchParams()
  const cameBackUnpaid = search.has("cancelled")
  // Read once, at arrival: closing the popup drops `?paid=1` from the URL,
  // and the page must stay the order rather than go back to asking.
  const [paidOnArrival] = useState(() => search.has("paid"))

  const [open] = useMutation(OPEN_ORDER_PAYMENT)
  const client = useApolloClient()
  const [opening, setOpening] = useState<Opening | null>(null)
  /** A closed order whose payment was sent back — see `closedBecauseRefunded`. */
  const [refunded, setRefunded] = useState(false)
  const [state, setState] = useState<"working" | "ready" | "invalid">(
    "working",
  )

  /**
   * Why a `CLOSED` order is closed, as far as this page can say it.
   *
   * `CLOSED` carries no reason, and for most orders "cancelled or expired" is
   * all there is to say. One case deserves better: a card payment that could
   * not be applied to the order and was refunded. That customer *paid*, and
   * opens this link to find out where the money went — telling them the order
   * "may have expired" answers nothing. The order behind the link is read with
   * the same token (`payLinkOrder`, what the paid page already shows), and its
   * payment status says which closed this is. Any failure reads as the plain
   * closed page, which is still true.
   */
  const closedBecauseRefunded = useCallback(async () => {
    try {
      const res = await client.query({
        query: PAY_LINK_ORDER,
        variables: { token },
        fetchPolicy: "network-only",
      })
      return isPaymentRefunded(res.data?.payLinkOrder.data?.payment.status)
    } catch {
      return false
    }
  }, [client, token])

  const load = useCallback(async () => {
    setState("working")
    try {
      const res = await open({ variables: { token } })
      const data = res.data?.openOrderPayment.data
      if (!data) {
        setState("invalid")
        return
      }
      // Asked before the page leaves "working", so a refunded order never
      // flashes the generic closed card first.
      // A reason on the opening answer is the whole story. The second read
      // stays for an API that has not started sending one.
      const wasRefunded =
        data.state !== "CLOSED"
          ? false
          : data.closed_reason
            ? data.closed_reason === "refunded"
            : await closedBecauseRefunded()
      setOpening(data)
      setRefunded(wasRefunded)
      setState("ready")
    } catch {
      setState("invalid")
    }
  }, [open, token, closedBecauseRefunded])

  /**
   * Guards the double-invoke React runs in development. A ref rather than
   * state: it is read during the effect that sets it, and nothing renders
   * differently for it.
   */
  const asked = useRef(false)
  useEffect(() => {
    // Back from the provider paid: the order is what to show, and asking
    // for a payment again could only open another one.
    if (paidOnArrival || asked.current) return
    asked.current = true
    void load()
  }, [load, paidOnArrival])

  /** Straight on to the provider, once, unless they just came back from it. */
  const forwarded = useRef(false)
  const forwardTo =
    opening?.state === "PAYABLE" && !cameBackUnpaid
      ? (opening.payment_url ?? null)
      : null
  useEffect(() => {
    if (!forwardTo || forwarded.current) return
    forwarded.current = true
    window.location.replace(forwardTo)
  }, [forwardTo])

  if (paidOnArrival) {
    return <OrderDetail payToken={token} placed />
  }

  if (state === "working") {
    return (
      <AuthCard title={t("working.title")} subtitle={t("working.subtitle")}>
        <div className="flex justify-center py-6">
          <Loader2
            className="size-6 animate-spin text-muted-foreground"
            aria-hidden
          />
        </div>
      </AuthCard>
    )
  }

  const shopLink = <Link href={shopHomeHref(base)} />

  if (state === "invalid" || !opening) {
    return (
      <AuthCard title={t("invalid.title")} subtitle={t("invalid.subtitle")}>
        <Button className="w-full" nativeButton={false} render={shopLink}>
          {t("invalid.action")}
        </Button>
      </AuthCard>
    )
  }

  const facts = {
    tracking: opening.tracking_number,
    total: formatMoney(opening.total_cents, opening.currency, locale),
  }

  // Paid already — the link opened again later: the order, without the
  // popup that belongs to the moment of paying.
  if (opening.state === "PAID") {
    return <OrderDetail payToken={token} placed={false} />
  }

  if (opening.state === "PROCESSING") {
    return (
      <AuthCard
        title={t("processing.title")}
        subtitle={t("processing.subtitle", facts)}
      >
        <Button variant="outline" className="w-full" onClick={() => void load()}>
          {t("processing.action")}
        </Button>
      </AuthCard>
    )
  }

  if (opening.state === "PAYABLE" && opening.payment_url) {
    const paymentUrl = opening.payment_url
    // On the way to the provider. The button is the fallback for a browser
    // that held the forward back, and says so.
    if (!cameBackUnpaid) {
      return (
        <AuthCard
          title={t("redirecting.title")}
          subtitle={t("redirecting.subtitle", facts)}
        >
          <div className="space-y-4">
            <div className="flex justify-center py-2">
              <Loader2
                className="size-6 animate-spin text-muted-foreground"
                aria-hidden
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.replace(paymentUrl)}
            >
              {t("redirecting.action")}
            </Button>
          </div>
        </AuthCard>
      )
    }
    return (
      <AuthCard
        title={t("payable.title")}
        subtitle={t("payable.subtitle", facts)}
      >
        <div className="space-y-4">
          {cameBackUnpaid && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              {t("payable.notCompleted")}
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => window.location.assign(paymentUrl)}
          >
            {t("payable.action")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t("payable.secure")}
          </p>
        </div>
      </AuthCard>
    )
  }

  // Closed, and the payment that came for it was sent back: say that, and
  // which order and how much, rather than "it may have expired".
  if (opening.state === "CLOSED" && refunded) {
    return (
      <AuthCard
        title={t("closed.refundedTitle")}
        subtitle={t("closed.refundedSubtitle", facts)}
      >
        <Button className="w-full" nativeButton={false} render={shopLink}>
          {t("closed.action")}
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t("closed.title")} subtitle={t("closed.subtitle")}>
      <Button className="w-full" nativeButton={false} render={shopLink}>
        {t("closed.action")}
      </Button>
    </AuthCard>
  )
}
