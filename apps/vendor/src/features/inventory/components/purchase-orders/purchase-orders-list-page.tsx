"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useSuspenseQuery } from "@apollo/client/react"
import {
  FileText,
  Plus,
  Loader2,
  Building,
  CalendarDays,
} from "lucide-react"
import {
  GET_PURCHASE_ORDERS,
  GET_INVENTORY_LOCATIONS,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { EmptyState, EmptyStateInline } from "@/shared/components/empty-state"
import { PurchaseOrdersIllustration } from "@/features/inventory/components/empty-illustrations"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import { cn } from "@/shared/lib/utils"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"

// Tab labels live in `inventory.purchaseOrders.status.<value>`.
const STATUS_OPTIONS = [
  "all",
  "DRAFT",
  "ORDERED",
  "PARTIAL",
  "RECEIVED",
  "CLOSED",
] as const

type POLine = {
  id: string
  quantity: number
  received_quantity: number
  rejected_quantity: number
  unit_cost_cents: number
}
type PO = {
  id: string
  supplier_id?: string | null
  destination_location_id: string
  status: "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CLOSED"
  reference?: string | null
  expected_at?: string | null
  currency_code?: string | null
  total_cents: number
  ordered_at?: string | null
  received_at?: string | null
  created_at: string
  supplier?: { id: string; name: string } | null
  lines: POLine[]
}

export function PurchaseOrdersListPage() {
  const t = useTranslations("inventory")
  const tPo = useTranslations("inventory.purchaseOrders")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const { data: locsData } = useSuspenseQuery<{
    inventoryLocations: { data: Array<{ id: string; name: string }> }
  }>(GET_INVENTORY_LOCATIONS)
  const locations = locsData?.inventoryLocations?.data ?? []
  const locName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id.slice(0, 6)

  const { data, loading } = useQuery<{
    purchaseOrders: {
      data: PO[]
      meta: { total: number; total_pages: number }
    }
  }>(GET_PURCHASE_ORDERS, {
    variables: {
      status: status === "all" ? undefined : status,
      page,
      limit: 25,
    },
    fetchPolicy: "cache-and-network",
  })

  const pos = data?.purchaseOrders?.data ?? []
  const meta = data?.purchaseOrders?.meta
  // Truly empty (no PO at all) vs filtered-to-zero — drives Shopify-style
  // full-card empty state vs the compact in-table "no match" message.
  const isPristineEmpty =
    !loading && pos.length === 0 && status === "all" && !search.trim()
  const filtered = search.trim()
    ? pos.filter((p) =>
        [p.reference, p.supplier?.name]
          .filter(Boolean)
          .some((x) => x!.toLowerCase().includes(search.toLowerCase())),
      )
    : pos

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {shopSlug && (
              <Link
                href={`/store/${shopSlug}/products/inventory`}
                className="hover:text-foreground"
              >
                {t("title")}
              </Link>
            )}
            <span>/</span>
            <span>{tPo("crumb")}</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold">
            {tPo("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tPo("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shopSlug && (
            <Link
              href={`/store/${shopSlug}/products/inventory/suppliers`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Building className="size-4" />
              {tPo("suppliers")}
            </Link>
          )}
          {shopSlug && (
            <Link
              href={`/store/${shopSlug}/products/inventory/purchase-orders/new`}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" />
              {tPo("create")}
            </Link>
          )}
        </div>
      </div>

      {isPristineEmpty ? (
        <EmptyState
          illustration={<PurchaseOrdersIllustration className="size-40" />}
          title={tPo("emptyTitle")}
          description={tPo("emptyBody")}
          action={
            shopSlug && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/store/${shopSlug}/products/inventory/purchase-orders/new`}
                  />
                }
              >
                <Plus className="size-4" />
                {tPo("create")}
              </Button>
            )
          }
          footer={tPo("emptyFooter")}
        />
      ) : (
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <DataTableToolbar
          leading={
            <DataTableViewTabs aria-label={tPo("statusAria")}>
              {STATUS_OPTIONS.map((s) => (
                <DataTableViewTab
                  key={s}
                  selected={status === s}
                  onClick={() => setStatus(s)}
                >
                  {tPo(`status.${s}`)}
                </DataTableViewTab>
              ))}
            </DataTableViewTabs>
          }
          search={
            <DataTableSearch
              value={search}
              onChange={setSearch}
              placeholder={tPo("search")}
            />
          }
        />

        <div>
          {loading && pos.length === 0 && (
            <div className="px-3 py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto size-4 animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <EmptyStateInline
              title={tPo("noMatching")}
              description={tPo("noMatchingBody")}
            />
          )}
          {filtered.map((p) => {
            const totalQty = p.lines.reduce((s, l) => s + l.quantity, 0)
            const totalReceived = p.lines.reduce(
              (s, l) => s + l.received_quantity + l.rejected_quantity,
              0,
            )
            return (
              <Link
                key={p.id}
                href={
                  shopSlug
                    ? `/store/${shopSlug}/products/inventory/purchase-orders/${p.id}`
                    : "#"
                }
                className="flex items-center justify-between border-b border-border/60 px-3 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {p.reference ?? tPo("poNumber", { id: p.id.slice(0, 6) })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.supplier?.name && <span>{p.supplier.name}</span>}
                      {p.supplier?.name && <span>·</span>}
                      <span>{locName(p.destination_location_id)}</span>
                      <span>·</span>
                      <span>
                        {tPo("receivedProgress", {
                          received: totalReceived,
                          total: totalQty,
                        })}
                      </span>
                      {p.expected_at && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {tPo("eta", {
                              date: formatDate(p.expected_at),
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums">
                    {fmtMoney(p.total_cents, p.currency_code ?? "USD")}
                  </span>
                  <StatusPill status={p.status} />
                </div>
              </Link>
            )
          })}
        </div>

        {meta && meta.total > 25 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>
              {t("pagination.pagedOf", {
                from: Math.min((page - 1) * 25 + 1, meta.total),
                to: Math.min(page * 25, meta.total),
                total: meta.total,
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t("pagination.previous")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                disabled={page >= meta.total_pages}
              >
                {t("pagination.next")}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: PO["status"] }) {
  const tPo = useTranslations("inventory.purchaseOrders")
  const tone: Record<PO["status"], string> = {
    DRAFT: "text-muted-foreground bg-muted",
    ORDERED:
      "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40",
    PARTIAL:
      "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40",
    RECEIVED:
      "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
    CLOSED:
      "text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/40",
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        tone[status],
      )}
    >
      {tPo(`status.${status}`)}
    </span>
  )
}

function fmtMoney(cents: number, currency: string) {
  return formatMoneyCents(cents, currency)
}
