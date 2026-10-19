"use client"

import Image from "@/shared/components/app-image"
import { useCallback, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { formatDate, formatDateTime, formatMoney } from "@/shared/lib/format"
import { imageRef, text } from "@/shared/lib/multilang"
import { useShop } from "@/features/shop/shop-context"
import { CANCEL_ORDER, MY_ORDERS, ORDER_DETAIL, PAY_LINK_ORDER } from "../api"
import { OrderPlacedDialog } from "./order-placed-dialog"
import { OrderTimeline } from "./order-timeline"
import { TelegramUpdatesCard } from "@/features/telegram/components/telegram-updates-card"
import { ORDER_BANK_TRANSFERS } from "@/features/bank-transfers/api"
import { CREATE_PAYMENT_LINK } from "@/features/checkout/api"
import { validationMessage } from "@/shared/lib/validation-errors"
import { OrderBankTransfer } from "@/features/bank-transfers/components/order-bank-transfer"
import {
  FULFILLMENT_LABEL_KEY,
  PAYMENT_LABEL_KEY,
  STATUS_CHIP_CLASS,
  STATUS_LABEL_KEY,
  canCancel,
  canPayByCard,
  displayStatus,
  paymentGatewayLabel,
  orderPaymentDueDate,
} from "../lib/status"

/**
 * One order.
 *
 * Doubles as the **order-confirmation screen**: checkout redirects here with
 * `?placed=1`, which opens `OrderPlacedDialog` over it. One screen rather than
 * two, because dismissing the confirmation should leave the customer on their
 * order rather than on an empty "thanks" page — and a separate route would mean
 * the "view your order" link went somewhere they had effectively already seen.
 *
 * **Or the order behind a chat's pay link** (`payToken`): the page Stripe
 * sends a paying customer back to shows this same screen, read with the
 * link's token rather than a session — somebody paying from a chat has
 * usually never signed in on this browser — with the same popup, opened by
 * `?paid=1`. Read-only: nothing here that needs a session (cancelling, the
 * transfer receipt, Telegram updates, the list of their orders) is shown.
 */
export function OrderDetail({
  orderId,
  payToken,
  placed: placedByCaller,
}: {
  orderId?: string
  payToken?: string
  /** For a caller that decided it (the pay page, at arrival). */
  placed?: boolean
}) {
  const t = useTranslations("orders")
  const tCommon = useTranslations("common")
  const tCheckout = useTranslations("checkout")
  const tPay = useTranslations("pay")
  const locale = useLocale()
  const searchParams = useSearchParams()
  const { slug, shop, base } = useShop()

  const router = useRouter()
  const pathname = usePathname()
  const [passDismissed, setPassDismissed] = useState(false)

  const byLink = Boolean(payToken)
  const justPlaced = placedByCaller ?? searchParams.has("placed")

  /**
   * Drops `?placed=1` as well as closing, so a reload or a back-navigation does
   * not reopen a confirmation the customer has already dismissed. `scroll:
   * false` because the order is already at the top of the page behind it.
   */
  const dismissPass = useCallback(() => {
    setPassDismissed(true)
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  const account = useQuery(ORDER_DETAIL, {
    variables: { id: orderId ?? "" },
    fetchPolicy: "cache-and-network",
    skip: byLink || !orderId,
  })
  const link = useQuery(PAY_LINK_ORDER, {
    variables: { token: payToken ?? "" },
    fetchPolicy: "cache-and-network",
    skip: !byLink,
  })
  const loading = byLink ? link.loading : account.loading
  const refetch = byLink ? link.refetch : account.refetch

  const [cancelOrder, { loading: cancelling }] = useMutation(CANCEL_ORDER, {
    refetchQueries: [MY_ORDERS],
  })
  const [createPaymentLink] = useMutation(CREATE_PAYMENT_LINK)
  // Held through the navigation to Stripe, so the button cannot open a second
  // session while the first page is loading.
  const [openingPayment, setOpeningPayment] = useState(false)

  const order =
    (byLink
      ? link.data?.payLinkOrder.data
      : account.data?.order.data) ?? null
  const isBankTransfer = order?.payment.gateway?.toUpperCase() === "BANK_TRANSFER"
  // The receipts are the signed-in customer's: a pay link is for a card.
  const bankTransfers = useQuery(ORDER_BANK_TRANSFERS, {
    variables: { order_id: order?.id ?? orderId ?? "" },
    skip: !isBankTransfer || byLink,
    fetchPolicy: "no-cache",
  })
  const transfers = bankTransfers.data?.orderBankTransfers.data ?? []
  const bankTransferOutstanding = isBankTransfer && (
    bankTransfers.loading || Boolean(bankTransfers.error) || transfers.some((transfer) => ["pending", "approved"].includes(transfer.status.toLowerCase()))
  )

  if (loading && !order) {
    return (
      <div className="shop-container animate-pulse py-10">
        <div className="h-64 rounded-3xl bg-muted ring-1 ring-shop-hairline" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="shop-container py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <h1 className="relative font-heading text-shop-title font-semibold tracking-tight">
            {t("notFound")}
          </h1>
          <Button
            variant="outline"
            className="relative mt-8 rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
            nativeButton={false}
            render={
              <Link href={byLink ? `${base}/` : `${base}/account/orders`} />
            }
          >
            {byLink ? tPay("invalid.action") : t("title")}
          </Button>
        </div>
      </div>
    )
  }

  const status = displayStatus(order)
  const shipping = order.addresses?.shipping as Record<string, unknown> | null
  /**
   * The method that priced the delivery fee, frozen on the order at creation
   * — so "Express" still reads Express after the shop edits its rates. Absent
   * on orders predating the snapshot and on merchant-set fees.
   */
  const shippingMethod = order.shipping_method as { name?: unknown } | null
  const shippingMethodName = shippingMethod?.name
    ? text(shippingMethod.name, locale)
    : ""

  return (
    <div className="shop-container py-10">
      {/*
        `?placed=1` is a link like any other, so it survives being shared and
        bookmarked. `showPass` gates on the status too: a forward-looking
        confirmation floating over an order that was cancelled three months ago
        is the worst thing this screen could do, and it costs one expression.
      */}
      <OrderPlacedDialog
        order={order}
        shopName={shop?.name ?? slug}
        open={
          justPlaced &&
          !passDismissed &&
          status !== "cancelled" &&
          status !== "refunded"
        }
        onClose={dismissPass}
      />

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-shop-title font-semibold tracking-tight">
            {t("detailsTitle", { tracking: order.tracking_number })}
          </h1>
          <p className="mt-1.5 text-shop-body text-sm text-muted-foreground">
            {t("placedOn", { date: formatDateTime(order.created_at, locale) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_CHIP_CLASS[status],
            )}
          >
            {t(STATUS_LABEL_KEY[status])}
          </span>
          {/*
            A card checkout cancelled on Stripe returns here, which used to
            leave no way to retry. A pay link has its own page for this, so
            only a signed-in customer's order offers it. Not while `?placed=1`
            is on the URL: that is Stripe's return after paying, when the order
            can still read unpaid for the seconds before its webhook lands.
          */}
          {!byLink && !justPlaced && canPayByCard(order) && (
            <Button
              size="sm"
              className="rounded-full"
              disabled={openingPayment}
              onClick={async () => {
                setOpeningPayment(true)
                try {
                  const res = await createPaymentLink({
                    variables: { order_id: order.id, payment_gateway: "STRIPE" },
                  })
                  const url = res.data?.createPaymentLink.payment_url
                  if (url) {
                    window.location.assign(url)
                    return
                  }
                  sileo.error({ title: tCommon("somethingWentWrong") })
                } catch (error) {
                  sileo.error({
                    title: validationMessage(
                      error,
                      tCommon("somethingWentWrong"),
                    ),
                  })
                  // The order may have closed or been paid meanwhile.
                  void refetch()
                }
                setOpeningPayment(false)
              }}
            >
              {tPay("payable.action")}
            </Button>
          )}
          {!byLink && canCancel(order) && !bankTransferOutstanding && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
              disabled={cancelling}
              onClick={async () => {
                if (!window.confirm(t("cancelConfirm"))) return
                try {
                  await cancelOrder({ variables: { id: order.id } })
                  sileo.success({ title: t("cancelled") })
                } catch (error) {
                  sileo.error({
                    title: tCommon("somethingWentWrong"),
                    description:
                      error instanceof Error ? error.message : undefined,
                  })
                }
              }}
            >
              {t("cancel")}
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <OrderTimeline order={order} />
          {/*
            Directly under the timeline, because the timeline is the thing the
            offer is about: "this is where your order is" followed by "have the
            next step reach you". It renders nothing at all unless the shop has
            a bot and this customer has not already opted in, so on most orders
            this line costs one query and no pixels.
          */}
          {!byLink && <TelegramUpdatesCard />}
          {isBankTransfer && !byLink && <OrderBankTransfer
            orderId={order.id}
            account={order.payment_instructions}
            amountDueCents={order.pricing.total_cents}
            currency={order.currency}
            orderStatus={order.order_status}
            paymentStatus={order.payment.status}
            expiresAt={order.payment_expires_at}
            transfers={transfers}
            loading={bankTransfers.loading}
            error={bankTransfers.error}
            onRefresh={() => Promise.all([refetch(), bankTransfers.refetch()])}
          />}
          <section className="shop-panel divide-y divide-shop-hairline">
            {order.products.map((line) => {
              const image = imageRef(line.image)
              const name = text(line.name, locale, line.slug ?? "")
              return (
                <div key={line.id} className="flex gap-4 p-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline">
                    {image ? (
                      <Image
                        src={image.thumbnail ?? image.original}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      {line.slug ? (
                        <Link
                          href={`${base}/products/${line.slug}`}
                          className="text-sm font-medium hover:text-shop-accent"
                        >
                          {name}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">{name}</p>
                      )}
                      {line.variation_title && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {text(line.variation_title, locale)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {line.order_quantity} ×{" "}
                        {formatMoney(line.unit_price_cents, order.currency, locale)}
                      </p>
                    </div>
                    <span className="shrink-0 font-heading text-sm font-semibold tabular-nums">
                      {formatMoney(line.subtotal_cents, order.currency, locale)}
                    </span>
                  </div>
                </div>
              )
            })}
          </section>

          {shipping && (
            <section className="shop-panel p-6">
              <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
                {t("shippingTo")}
              </h2>
              <address className="text-sm leading-relaxed text-muted-foreground not-italic">
                {formatAddressLines(shipping).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </section>
          )}



          {order.note && (
            <section className="shop-panel p-6">
              <h2 className="mb-2 font-heading text-lg font-semibold tracking-tight">
                {t("note")}
              </h2>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {order.note}
              </p>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="shop-panel flex flex-col gap-3 p-6">
            <h2 className="font-heading text-shop-title font-semibold tracking-tight">
              {t("orderSummary")}
            </h2>

            <dl className="flex flex-col gap-2 text-sm">
              <Row
                label={t("subtotal")}
                value={formatMoney(
                  order.pricing.subtotal_cents,
                  order.currency,
                  locale,
                )}
                muted
              />
              {order.pricing.delivery_fee_cents > 0 && (
                <Row
                  label={
                    shippingMethodName
                      ? `${t("shipping")} · ${shippingMethodName}`
                      : t("shipping")
                  }
                  value={formatMoney(
                    order.pricing.delivery_fee_cents,
                    order.currency,
                    locale,
                  )}
                  muted
                />
              )}
              {order.pricing.discount_cents > 0 && (
                <Row
                  label={t("discount")}
                  value={`− ${formatMoney(order.pricing.discount_cents, order.currency, locale)}`}
                  muted
                />
              )}
              <div className="border-t border-shop-hairline pt-2">
                <Row
                  label={t("total")}
                  value={formatMoney(
                    order.pricing.total_cents,
                    order.currency,
                    locale,
                  )}
                />
              </div>
            </dl>

            <div className="border-t border-shop-hairline pt-3 text-sm">
              <p className="text-muted-foreground">{t("paymentMethod")}</p>
              <p className="mt-1 font-medium">
                {paymentGatewayLabel(order.payment.gateway, tCheckout)}
                {" · "}
                <span className="font-normal text-muted-foreground">
                  {t(
                    PAYMENT_LABEL_KEY[order.payment.status.toLowerCase()] ??
                      "paymentPending",
                  )}
                </span>
              </p>
              {(() => {
                const dueDate =
                  order.payment.status === "payment-pending"
                    ? orderPaymentDueDate(order)
                    : null
                if (!dueDate) return null
                return (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("paymentDue", { date: formatDate(dueDate, locale) })}
                  </p>
                )
              })()}
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  FULFILLMENT_LABEL_KEY[
                    order.fulfillment_status.toLowerCase()
                  ] ?? "fulfillmentUnfulfilled",
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-muted-foreground" : "font-medium"}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          !muted && "font-heading text-lg font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Render the address JSON as lines.
 *
 * `OrderAddresses.shipping` is a frozen snapshot of whatever the checkout sent,
 * so it is `JSON` with no guaranteed keys. Reading a known order and skipping
 * blanks keeps an order placed before this app existed readable instead of
 * showing `[object Object]`.
 */
export function formatAddressLines(address: Record<string, unknown>): string[] {
  const order = [
    "street_address",
    "street",
    "address_line_1",
    "city",
    "state",
    "zip",
    "postal_code",
    "country",
  ]
  const seen = new Set<string>()
  const lines: string[] = []

  for (const key of order) {
    const value = address[key]
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    lines.push(trimmed)
  }
  return lines
}
