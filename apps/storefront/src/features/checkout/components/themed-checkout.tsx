"use client"

import { useLocale, useTranslations } from "next-intl"

import type { CheckoutFrameProps } from "@repo/storefront-templates/checkout-frame"

import { formatMoney } from "@/shared/lib/format"
import { shopHomeHref } from "@/shared/lib/tenant"
import { checkoutMoneyRows } from "../lib/ledger"
import { useCheckout, type CheckoutReady } from "../use-checkout"
import { TemplateCheckoutFields } from "./template-fields"

/** Shared checkout session, painted by one template frame. */
export function useCheckoutFrame(): CheckoutFrameProps {
  const session = useCheckout()
  const t = useTranslations("checkout")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  return frameProps(session, t, tCommon, locale)
}

function frameProps(
  session: ReturnType<typeof useCheckout>,
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
  locale: string,
): CheckoutFrameProps {
  const base = session.base
  const shared = {
    shopName: session.shopName,
    homeHref: shopHomeHref(base),
    title: t("title"),
    backHref: `${base}/cart`,
    backLabel: t("backToCart"),
    placeLabel: t("placeOrder"),
    placingLabel: t("placing"),
    notice: undefined,
    lang: locale === "ar" ? "ar" as const : "en" as const,
  }

  if (session.status === "loading") {
    return {
      ...shared,
      lines: [],
      moneyRows: [],
      totalLabel: t("total"),
      total: "",
      pending: true,
      placing: false,
      canPlace: false,
      onPlace: () => {},
      fields: null,
      empty: null,
      loading: true,
    }
  }

  if (session.status === "empty") {
    return {
      ...shared,
      lines: [],
      moneyRows: [],
      totalLabel: t("total"),
      total: "",
      pending: false,
      placing: false,
      canPlace: false,
      onPlace: () => {},
      fields: null,
      empty: {
        title: t("emptyCart"),
        href: `${session.base}/products`,
        action: tCommon("continue"),
      },
      loading: false,
    }
  }

  return {
    ...shared,
    shopName: session.shopName,
    ...readyBits(session, t, tCommon, locale),
    placing: session.placing,
    canPlace: session.canPlace,
    onPlace: session.handlePlaceOrder,
    fields: <TemplateCheckoutFields session={session} />,
    empty: null,
    loading: false,
    placeLabel: session.actionLabel,
  }
}

function readyBits(
  session: CheckoutReady,
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
  locale: string,
) {
  const money = (cents: number) => formatMoney(cents, session.activeCurrency, locale)
  const quote = session.quote
  return {
    lines: session.orderable.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.quantity,
    })),
    moneyRows: checkoutMoneyRows({
      needsShipping: session.needsShipping,
      addressReady: session.addressReady,
      hasQuote: quote != null,
      shippingAvailable: quote?.shipping_available ?? false,
      shippingFeeCents: quote?.shipping_fee_cents ?? 0,
      discountCents: quote?.discount_cents ?? 0,
      taxCents: quote?.tax_cents ?? 0,
      subtotal: money(quote?.subtotal_cents ?? session.summary?.subtotal_price_cents ?? 0),
      shipping: money(quote?.shipping_fee_cents ?? 0),
      freeLabel: tCommon("free"),
      pending: "—",
      discount: `− ${money(quote?.discount_cents ?? 0)}`,
      tax: money(quote?.tax_cents ?? 0),
      labels: {
        subtotal: t("subtotal"),
        shipping: t("estimatedShipping"),
        discount: t("discount"),
        tax: t("tax"),
      },
    }),
    totalLabel: t("total"),
    total: money(session.totalCents),
    pending: session.verifying,
  }
}
