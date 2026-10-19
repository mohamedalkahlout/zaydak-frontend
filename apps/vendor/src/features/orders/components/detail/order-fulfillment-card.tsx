"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PackageIcon, TruckIcon } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import type { Order } from "@/features/orders/types"
import { formatDate } from "@/features/orders/lib/list/format"
import {
  canFulfill,
  fulfillmentStatusKey,
  orderRemainingToFulfill,
} from "@/features/orders/lib/detail/fulfillment"
import { FulfillDialog } from "./fulfill-dialog"

/**
 * Fulfillment state of the order: what is still to ship, and every shipment
 * already made (with its carrier tracking).
 *
 * `fulfillment_status` is orthogonal to `order_status` — an order can be paid
 * and unfulfilled, or shipped and later refunded — so this card reads it
 * directly rather than inferring shipping from the lifecycle status.
 */
export function OrderFulfillmentCard({ order }: { order: Order }) {
  const t = useTranslations("orders")
  const [dialogOpen, setDialogOpen] = useState(false)

  const fulfillments = order.fulfillments ?? []
  const remaining = orderRemainingToFulfill(order)
  const fulfillable = canFulfill(order)

  const status = order.fulfillment_status ?? "unfulfilled"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle>{t("fulfillmentCard.title")}</CardTitle>
          <Badge variant={status === "fulfilled" ? "secondary" : "outline"}>
            {t(fulfillmentStatusKey(status))}
          </Badge>
        </div>
        {fulfillable && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <PackageIcon className="size-4" />
            {t("fulfillmentCard.fulfillItems")}
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 text-sm">
        {remaining > 0 ? (
          <p className="text-muted-foreground">
            {fulfillable
              ? t("fulfillmentCard.remaining", { count: remaining })
              : t("fulfillmentCard.remainingBlocked", { count: remaining })}
          </p>
        ) : (
          <p className="text-muted-foreground">
            {t("fulfillmentCard.allShipped")}
          </p>
        )}

        {fulfillments.map((f) => {
          const units = f.line_items.reduce((sum, l) => sum + l.quantity, 0)
          return (
            <div
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <TruckIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {f.status === "cancelled"
                    ? t("fulfillmentCard.shippedCancelled", { count: units })
                    : t("fulfillmentCard.shipped", { count: units })}
                </p>
                {f.tracking_number && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {f.tracking_company ? `${f.tracking_company} · ` : ""}
                    {f.tracking_url ? (
                      <a
                        href={f.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {f.tracking_number}
                      </a>
                    ) : (
                      f.tracking_number
                    )}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(f.shipped_at ?? f.created_at)}
              </span>
            </div>
          )
        })}
      </CardContent>

      <FulfillDialog
        order={order}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  )
}
