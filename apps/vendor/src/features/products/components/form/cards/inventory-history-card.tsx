"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { History, ChevronRight } from "lucide-react"
import { GET_INVENTORY_HISTORY } from "@/features/inventory/api"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"

type AdjustmentRow = {
  id: string
  location_id: string
  product_id: string | null
  variation_option_id: string | null
  reason: string
  delta: number
  available_before: number
  available_after: number
  reference_type: string | null
  reference_id: string | null
  note: string | null
  actor_user_id: string | null
  created_at: string
}

type HistoryResponse = {
  inventoryHistory: {
    success: boolean
    data: AdjustmentRow[]
    meta?: { total: number; page: number; total_pages: number }
  }
}

const PAGE_SIZE = 10

/**
 * Inventory History — Shopify-parity audit log for a single product.
 * Newest-first list of every InventoryAdjustment row (SALE, RETURN,
 * MANUAL_ADJUSTMENT, TRANSFER_*, CORRECTION). Lazy-loaded via Apollo
 * useQuery so the parent product form stays snappy; clicking "View
 * history" expands and fetches on demand.
 *
 * Hidden in create mode — there's no productId yet, so nothing to show.
 */
export function InventoryHistoryCard({ productId }: { productId?: string }) {
  const t = useTranslations("products.inventoryHistory")
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { data, loading, error } = useQuery<HistoryResponse>(
    GET_INVENTORY_HISTORY,
    {
      variables: { product_id: productId, page, limit: PAGE_SIZE },
      skip: !productId || !open,
      fetchPolicy: "cache-and-network",
    }
  )

  if (!productId) return null

  const rows = data?.inventoryHistory?.data ?? []
  const meta = data?.inventoryHistory?.meta
  const total = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            {t("title")}
            {open && total > 0 && (
              <Badge variant="secondary">{total}</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t("hide") : t("show")}
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                open && "rotate-90"
              )}
            />
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-3">
          {loading && rows.length === 0 && (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          )}

          {error && (
            <p className="text-sm text-destructive">
              {t("loadFailed", { message: error.message })}
            </p>
          )}

          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          )}

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">{t("when")}</th>
                    <th className="px-3 py-2 text-start">{t("reason")}</th>
                    <th className="px-3 py-2 text-end">{t("delta")}</th>
                    <th className="px-3 py-2 text-end">{t("available")}</th>
                    <th className="px-3 py-2 text-start">{t("note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-foreground/5 transition-colors hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2">
                        <ReasonBadge reason={row.reason} />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-end font-medium tabular-nums",
                          row.delta > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-destructive"
                        )}
                      >
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {row.available_before} → {row.available_after}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.note ||
                          (row.reference_type
                            ? `${row.reference_type}${
                                row.reference_id ? ` #${row.reference_id.slice(-6)}` : ""
                              }`
                            : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("pageSummary", { page, totalPages, total })}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("prev")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/**
 * The tone each adjustment reason wears. The words live in
 * `products.inventoryHistory.reasons.<REASON>`; a reason the client does not
 * know yet keeps its raw enum, which is more use to whoever reports it than a
 * guessed label.
 */
const REASON_TONES: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  SALE: "destructive",
  RETURN: "secondary",
  DAMAGE: "destructive",
  QUALITY_CONTROL: "outline",
  MANUAL_ADJUSTMENT: "secondary",
  TRANSFER_IN: "secondary",
  TRANSFER_OUT: "outline",
  RECEIPT: "secondary",
  CORRECTION: "outline",
}

function ReasonBadge({ reason }: { reason: string }) {
  const t = useTranslations("products.inventoryHistory.reasons")
  const tone = REASON_TONES[reason]
  return (
    <Badge variant={tone ?? "outline"}>{tone ? t(reason) : reason}</Badge>
  )
}
