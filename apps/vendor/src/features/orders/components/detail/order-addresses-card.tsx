"use client"

import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import type { Order } from "@/features/orders/types"

export function OrderAddressesCard({ order }: { order: Order }) {
  const t = useTranslations("orders.addressesCard")
  const shipping = order.addresses?.shipping
  const billing = order.addresses?.billing
  if (!shipping && !billing) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {shipping && <AddressBlock label={t("shipping")} address={shipping} />}
        {billing && sameAs(shipping, billing) ? (
          <p className="text-xs text-muted-foreground">{t("billingSame")}</p>
        ) : billing ? (
          <AddressBlock label={t("billing")} address={billing} />
        ) : null}
        {order.delivery?.time && (
          <div className="text-xs text-muted-foreground">
            {t("deliveryWindow", { time: order.delivery.time })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AddressBlock({
  label,
  address,
}: {
  label: string
  address: Record<string, unknown>
}) {
  const t = useTranslations("orders.addressesCard")
  const lines = [
    str(address.street_address),
    [str(address.city), str(address.state), str(address.zip)]
      .filter(Boolean)
      .join(", "),
    str(address.country),
  ].filter((l) => !!l && l.length > 0)

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("notProvided")}</p>
      ) : (
        lines.map((line, i) => (
          <p key={i} className="text-sm">
            {line}
          </p>
        ))
      )}
    </div>
  )
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function sameAs(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
): boolean {
  if (!a || !b) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}
