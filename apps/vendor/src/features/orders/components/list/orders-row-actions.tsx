"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRightIcon, EllipsisIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type { Order } from "@/features/orders/types"
import { canCancel } from "@/features/orders/lib/list/status-transitions"

export function OrdersRowActions({ order }: { order: Order }) {
  const t = useTranslations("orders.rowActions")
  const { shopSlug } = useParams<{ shopSlug: string }>()
  const href = `/store/${shopSlug}/orders/${order.id}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(p) => (
          <Button
            {...p}
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("label")}
          >
            <EllipsisIcon className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href={href} />}>
          {t("viewDetails")}
          <ArrowRightIcon className="ms-auto size-3.5 opacity-60 rtl:rotate-180" />
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={href} />}>
          {t("updateStatus")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canCancel(order.order_status)}
          render={<Link href={href} />}
        >
          {t("cancelOrder")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
