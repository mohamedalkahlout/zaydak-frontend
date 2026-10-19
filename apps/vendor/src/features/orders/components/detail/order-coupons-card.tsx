"use client"

import { TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import type { Order } from "@/features/orders/types"
import { formatMoneyCents } from "@/features/orders/lib/list/format"

export function OrderCouponsCard({ order }: { order: Order }) {
  const t = useTranslations("orders.couponsCard")
  const coupons = order.coupons ?? []
  if (coupons.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {coupons.map((c) => (
          <div
            key={c.coupon_id}
            className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 font-medium">
              <TagIcon className="size-3.5 text-muted-foreground" />
              {c.code}
            </span>
            <span className="tabular-nums text-emerald-700">
              - {formatMoneyCents(c.applied_discount_cents)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
