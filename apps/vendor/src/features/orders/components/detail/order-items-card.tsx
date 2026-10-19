"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Edit2Icon, ImageIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import type { Order, OrderProduct } from "@/features/orders/types"
import { translatable } from "@/shared/lib/format"
import { formatMoneyCents } from "@/features/orders/lib/list/format"
import { OrderEditDialog } from "./order-edit-dialog"

export function OrderItemsCard({ order }: { order: Order }) {
  const t = useTranslations("orders.itemsCard")
  const [editOpen, setEditOpen] = useState(false)
  const canEdit =
    order.order_status !== "order-cancelled" &&
    order.order_status !== "order-refunded" &&
    order.order_status !== "order-failed" &&
    order.fulfillment_status !== "fulfilled"

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t("title")}</CardTitle>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Edit2Icon className="size-3.5 me-1.5" />
              {t("editOrder")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {order.products.map((item) => (
            <OrderItemRow key={rowKey(item)} item={item} />
          ))}
        </CardContent>
      </Card>

      <OrderEditDialog
        order={order}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}

function rowKey(item: OrderProduct): string {
  return item.id ?? `${item.product_id}:${item.variation_option_id ?? ""}`
}

function OrderItemRow({ item }: { item: OrderProduct }) {
  const t = useTranslations("orders.itemsCard")
  const thumbnail =
    item.image && typeof item.image === "object" && "thumbnail" in item.image
      ? (item.image.thumbnail as string | undefined)
      : undefined
  const variantLabel = variantSummary(item)

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="size-full object-cover"
            width={48}
            height={48}
          />
        ) : (
          <ImageIcon className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {translatable(item.name) || item.product_id}
        </p>
        {variantLabel && (
          <p className="truncate text-xs text-muted-foreground">
            {variantLabel}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {formatMoneyCents(item.unit_price_cents)} × {item.order_quantity}
        </p>
        {item.variation_options?.shein_url && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            <a href={item.variation_options.shein_url} className="underline">
              {t("sheinSource", {
                amount: (
                  Number(item.variation_options.source_cents ?? 0) / 100
                ).toFixed(2),
                currency: item.variation_options.source_currency ?? "",
              })}
            </a>
            {". "}
            {t("sheinNote")}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right text-sm font-medium tabular-nums">
        {formatMoneyCents(
          item.subtotal_cents ?? item.unit_price_cents * item.order_quantity,
        )}
      </div>
    </div>
  )
}

function variantSummary(item: OrderProduct): string | null {
  const title = translatable(item.variation_title)
  if (title) return title
  const opts = item.variation_options
  if (!opts || typeof opts !== "object") return null
  const entries = Object.entries(opts).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  )
  if (entries.length === 0) return null
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ")
}
