"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type { OrderFilters } from "@/features/orders/types"
import { useOrdersExport } from "./use-orders-export"

export function OrdersHeader({
  totalCount,
  filters,
}: {
  totalCount: number
  /** The list's current filters and sort: the export is that same list. */
  filters?: OrderFilters
}) {
  const t = useTranslations("orders.list")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const draftsBase = shopSlug ? `/store/${shopSlug}/orders/drafts` : "#"
  const { exportOrders, exporting } = useOrdersExport(filters)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={draftsBase} />}
        >
          {t("viewDrafts")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <Button variant="outline" size="sm" {...triggerProps}>
                {t("moreActions")}
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              disabled={exporting || totalCount === 0}
              onClick={() => void exportOrders()}
            >
              {t("exportOrders")}
            </DropdownMenuItem>
            <DropdownMenuItem>{t("printPackingSlips")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t("importCsv")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`${draftsBase}/new`} />}
        >
          {t("createOrder")}
        </Button>
      </div>
    </div>
  )
}
