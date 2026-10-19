"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Bell, ChevronRight, Mail } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import { GET_PENDING_STOCK_NOTIFICATIONS } from "../api"
import type { PendingStockNotificationsResponse } from "../types"

/**
 * "Notify when back in stock" subscribers panel — surfaces pending demand
 * on the product edit page. Hidden in create mode (need a productId to
 * anchor the query). Lazy: collapsed by default, fetches only when opened
 * so the parent form's first paint stays fast.
 *
 * The subscribe mutation lives on the storefront — the vendor sees the
 * resulting subscribers here as a read-only audit list.
 *
 * On restock (available 0 → >0), the backend's
 * `StockNotificationsService.claimRestockSubs` flips `notified_at` and
 * the row stops appearing in this query. So the count visible here is
 * exactly the "still waiting" pool the vendor should size their next
 * restock against.
 */
export function StockNotificationsCard({ productId }: { productId?: string }) {
  const t = useTranslations("stockNotifications")
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  const { data, loading } = useQuery<PendingStockNotificationsResponse>(
    GET_PENDING_STOCK_NOTIFICATIONS,
    {
      variables: { product_id: productId },
      skip: !productId || !open,
      fetchPolicy: "cache-and-network",
    },
  )

  if (!productId) return null

  const rows = data?.pendingStockNotifications?.data ?? []
  const total = rows.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            {t("title")}
            {open && total > 0 && <Badge variant="secondary">{total}</Badge>}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? t("hide") : t("view")}
            <ChevronRight
              className={cn(
                "ms-1 size-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          {loading && rows.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{r.email}</span>
                    {r.variation_option_id && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {t("variant")}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString(locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("footnote")}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
