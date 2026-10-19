"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { UndoIcon } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_RETURNS } from "@/features/returns/api"
import type {
  ReturnEntry,
  ReturnStatus,
  ReturnsResponse,
} from "@/features/returns/types"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import { RETURN_STATUS_VARIANT } from "@/features/returns/lib/status"
import { RETURN_VIEWS, matchReturn, type ReturnView } from "@/features/returns/lib/match"
import { ReturnStatusActions } from "./return-status-actions"
import {
  DataTableCard,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"

/**
 * The RMA queue: every return raised against this shop, with the one action
 * that advances it.
 *
 * Returns are customer-initiated (the storefront calls `createReturn`), so
 * there is no "new return" button here — the merchant's job is to work the
 * queue, not to open it.
 */
export function ReturnsList() {
  const t = useTranslations("returns")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const { data, loading } = useQuery<ReturnsResponse>(GET_RETURNS, {
    variables: { page: 1, limit: 50 },
    fetchPolicy: "cache-and-network",
  })

  const [search, setSearch] = useState("")
  const [view, setView] = useState<ReturnView>("all")

  const returns: ReturnEntry[] = data?.returns?.data ?? []
  const filtered = useMemo(
    () => returns.filter((r) => matchReturn(r, search, view)),
    [returns, search, view],
  )

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
    </div>
  )

  const chrome = (
    <DataTableToolbar
      leading={
        <DataTableViewTabs aria-label={t("title")}>
          {RETURN_VIEWS.map((id) => (
            <DataTableViewTab
              key={id}
              selected={view === id}
              onClick={() => setView(id)}
            >
              {t(`views.${id}`)}
            </DataTableViewTab>
          ))}
        </DataTableViewTabs>
      }
      search={
        <DataTableSearch
          value={search}
          onChange={setSearch}
          placeholder={t("searchPlaceholder")}
        />
      }
    />
  )

  if (loading && returns.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <DataTableCard>
          {chrome}
          <div className="p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="my-2 h-12 w-full" />
            ))}
          </div>
        </DataTableCard>
      </div>
    )
  }

  if (returns.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <UndoIcon className="size-7 stroke-[1.5] text-muted-foreground" />
          </span>
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      <DataTableCard>
        {chrome}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.return")}
                </th>
                <th className="h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.order")}
                </th>
                <th className="h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.reason")}
                </th>
                <th className="h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.status")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.items")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.restockingFee")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.requested")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70 sr-only">
                  {t("columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    {t("noMatches")}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const items = r.line_items.reduce(
                    (n, li) => n + li.quantity,
                    0,
                  )
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-1.5 font-medium">
                        #R-{r.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-3 py-1.5">
                        {shopSlug ? (
                          <Link
                            href={`/store/${shopSlug}/orders/${r.order_id}`}
                            className="hover:underline"
                          >
                            {t("viewOrder")}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-1.5">
                        {r.reason || (
                          <span className="text-muted-foreground">
                            {t("noReason")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge
                          variant={
                            RETURN_STATUS_VARIANT[r.status as ReturnStatus]
                          }
                        >
                          {t(`views.${r.status as ReturnStatus}`)}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-end tabular-nums">
                        {items}
                      </td>
                      <td className="px-3 py-1.5 text-end tabular-nums">
                        {r.restocking_fee_cents > 0 ? (
                          formatMoneyCents(r.restocking_fee_cents)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-end text-muted-foreground tabular-nums">
                        {formatDate(r.requested_at)}
                      </td>
                      <td className="px-3 py-1.5 text-end">
                        <ReturnStatusActions entry={r} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </DataTableCard>
    </div>
  )
}
