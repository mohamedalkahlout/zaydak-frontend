"use client"

import { useEffect } from "react"
import { gql } from "@apollo/client"
import { useQuery } from "@apollo/client/react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { formatMoney } from "@/shared/lib/format"
import { setCookie } from "@/shared/lib/cookies"
import { CART_SESSION_COOKIE } from "@/shared/auth/cookie-names"
import { useCartSessionStore } from "@/shared/stores/cart-session"
import { useShop } from "@/features/shop/shop-context"
import AppImage from "@/shared/components/app-image"

const SHEIN_CART_VIEW = gql`
  query SheinCartView($token: String!) {
    sheinCartView(token: $token) {
      currency
      source_currency
      source_cents
      charged_cents
      session_id
      lines {
        name
        color
        size
        image
        quantity
        repeated
        source_cents
        source_currency
        unit_price_cents
      }
    }
  }
`

type Line = {
  name: string
  color?: string | null
  size?: string | null
  image?: string | null
  quantity: number
  repeated?: boolean
  source_cents: number
  source_currency: string
  unit_price_cents: number
}

type View = {
  currency: string
  source_currency: string
  source_cents: number
  charged_cents: number
  session_id?: string | null
  lines: Line[]
}

export function SheinCartView({ token }: { token: string }) {
  const t = useTranslations("cart")
  const locale = useLocale()
  const { base } = useShop()
  const { data, loading } = useQuery<{ sheinCartView: View | null }>(SHEIN_CART_VIEW, {
    variables: { token },
  })
  const view = data?.sheinCartView
  const sessionId = view?.session_id

  useEffect(() => {
    if (!sessionId) return
    setCookie(CART_SESSION_COOKIE, sessionId, { maxAge: 365 * 24 * 60 * 60 })
    useCartSessionStore.setState({ sessionId })
  }, [sessionId])

  if (loading) return null
  if (!view) {
    return (
      <section className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold">{t("sheinViewTitle")}</h1>
        <p className="mt-3 text-sm text-neutral-600">{t("sheinViewEmpty")}</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("sheinViewTitle")}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t("sheinViewNote")}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {view.lines.map((line, index) => {
          const variant = [line.color, line.size].filter(Boolean).join(" / ")
          return (
            <li key={`${line.name}-${index}`} className="shop-panel flex gap-4 p-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {line.image ? (
                  <AppImage src={line.image} alt="" fill sizes="80px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" dir="auto">{line.name}</p>
                {variant ? <p className="mt-0.5 text-xs text-muted-foreground" dir="auto">{variant}</p> : null}
                {line.repeated || line.quantity > 1 ? (
                  <p className="mt-1 text-xs font-medium text-shop-sale">{t("sheinViewRepeated")}</p>
                ) : null}
                <p className="mt-2 text-sm">
                  × {line.quantity} · {formatMoney(line.source_cents, line.source_currency, locale)}
                  {line.unit_price_cents !== line.source_cents
                    ? ` · ${formatMoney(line.unit_price_cents, view.currency, locale)}`
                    : ""}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt>{t("sheinViewSource")}</dt>
          <dd>{formatMoney(view.source_cents, view.source_currency, locale)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <dt>{t("sheinViewCustomer")}</dt>
          <dd>{formatMoney(view.charged_cents, view.currency, locale)}</dd>
        </div>
      </dl>
      <Link href={`${base}/checkout`} className="mt-6 inline-flex h-11 items-center rounded-md bg-neutral-900 px-4 text-sm text-white">
        {t("checkout")}
      </Link>
    </section>
  )
}
