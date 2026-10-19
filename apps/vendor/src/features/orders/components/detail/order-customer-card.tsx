"use client"

import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import type { Order } from "@/features/orders/types"
import { initials } from "@/shared/lib/format"

export function OrderCustomerCard({ order }: { order: Order }) {
  const t = useTranslations("orders.customerCard")
  const customer = order.customer
  const isGuest = !customer?.id
  const displayName = customer?.name || t("guest")
  const contact = customer?.phone || customer?.contact

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
            {initials(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {isGuest && (
              <p className="text-xs text-muted-foreground">
                {t("guestCheckout")}
              </p>
            )}
          </div>
        </div>

        {customer?.email && (
          <Row
            label={t("email")}
            value={customer.email}
            href={`mailto:${customer.email}`}
          />
        )}
        {contact && (
          <Row label={t("phone")} value={contact} href={`tel:${contact}`} />
        )}
        {order.language && <Row label={t("language")} value={order.language} />}
      </CardContent>
    </Card>
  )
}

/**
 * One labelled line. `href` makes the value a link — the label used to decide
 * that (`label === "Email"`), which stopped working the moment the label was
 * translated.
 */
function Row({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {href ? (
        <a href={href} className="text-sm text-foreground hover:underline">
          {value}
        </a>
      ) : (
        <span className="text-sm">{value}</span>
      )}
    </div>
  )
}
