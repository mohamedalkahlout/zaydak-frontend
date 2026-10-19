"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { FileTextIcon, PlusIcon } from "lucide-react"
import { GET_DRAFT_ORDERS } from "@/features/orders/api"
import type { DraftOrder, DraftOrdersResponse } from "@/features/orders/types"
import {
  DRAFT_VIEWS,
  draftNumber,
  matchDraft,
  type DraftView,
} from "@/features/orders/lib/drafts/match"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  DataTableCard,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "secondary",
  completed: "default",
  cancelled: "outline",
}

export function DraftOrdersList() {
  const t = useTranslations("draftOrders")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const draftsBase = shopSlug ? `/store/${shopSlug}/orders/drafts` : "#"

  const { data, loading } = useQuery<DraftOrdersResponse>(GET_DRAFT_ORDERS, {
    variables: { page: 1, limit: 50 },
    fetchPolicy: "cache-and-network",
  })

  const [search, setSearch] = useState("")
  const [view, setView] = useState<DraftView>("all")

  const drafts: DraftOrder[] = data?.draftOrders?.data ?? []
  const filtered = useMemo(
    () => drafts.filter((d) => matchDraft(d, search, view)),
    [drafts, search, view],
  )

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Button
        size="sm"
        nativeButton={false}
        render={<Link href={`${draftsBase}/new`} />}
      >
        <PlusIcon className="size-4" />
        {t("create")}
      </Button>
    </div>
  )

  const chrome = (
    <DataTableToolbar
      leading={
        <DataTableViewTabs aria-label={t("title")}>
          {DRAFT_VIEWS.map((id) => (
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

  if (loading && drafts.length === 0) {
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

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <FileTextIcon className="size-7 text-muted-foreground stroke-[1.5]" />
          </span>
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Button
            nativeButton={false}
            render={<Link href={`${draftsBase}/new`} />}
          >
            {t("createDraft")}
          </Button>
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
                  {t("columns.draft")}
                </th>
                <th className="h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.customer")}
                </th>
                <th className="h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.status")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.items")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.total")}
                </th>
                <th className="h-8 px-3 text-end text-xs font-medium tracking-normal text-foreground/70">
                  {t("columns.created")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    {t("noMatches")}
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const items = d.line_items.reduce(
                    (n, li) => n + li.quantity,
                    0,
                  )
                  const statusKey = DRAFT_VIEWS.includes(
                    d.status as DraftView,
                  )
                    ? (`views.${d.status}` as const)
                    : null
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-1.5 font-medium">
                        <Link
                          href={`${draftsBase}/${d.id}`}
                          className="hover:underline"
                        >
                          {draftNumber(d.id)}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        {d.customer_name || (
                          <span className="text-muted-foreground">
                            {t("noCustomer")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                          {statusKey ? t(statusKey) : d.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-end tabular-nums">
                        {items}
                      </td>
                      <td className="px-3 py-1.5 text-end tabular-nums">
                        {formatMoneyCents(d.estimated_total_cents, d.currency)}
                      </td>
                      <td className="px-3 py-1.5 text-end text-muted-foreground tabular-nums">
                        {formatDate(d.created_at)}
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
