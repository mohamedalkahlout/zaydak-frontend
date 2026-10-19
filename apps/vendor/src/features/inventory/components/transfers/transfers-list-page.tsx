"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeftRight,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react"
import { sileo } from "sileo"
import {
  GET_INVENTORY_TRANSFERS,
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_TRANSFER_STATS,
  UPDATE_INVENTORY_TRANSFER,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Switch } from "@repo/ui/components/switch"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@repo/ui/components/hover-card"
import { EmptyState } from "@/shared/components/empty-state"
import { TransfersIllustration } from "@/features/inventory/components/empty-illustrations"
import { cn } from "@/shared/lib/utils"
import {
  DataTableSelectionBar,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"
import {
  imageThumb,
  StatusBadge,
  formatTransferNumber,
  shipmentLabel,
  type TransferStatus,
} from "./transfer-helpers"
import { BulkTagsDialog } from "./bulk-tags-dialog"

const FILTERS = [
  "all",
  "DRAFT",
  "READY_TO_SHIP",
  "IN_PROGRESS",
  "TRANSFERRED",
  "CANCELLED",
] as const
type FilterValue = (typeof FILTERS)[number]
const PAGE_SIZE = 25

function filterToVars(f: FilterValue): {
  status?: string
  statuses?: string[]
} {
  switch (f) {
    case "all":
      return {}
    case "IN_PROGRESS":
      return { statuses: ["SENT", "PARTIAL"] }
    case "TRANSFERRED":
      return { status: "RECEIVED" }
    default:
      return { status: f }
  }
}

type TransferLine = {
  id: string
  quantity: number
  received_quantity: number
  product_name?: Record<string, string> | string | null
  variant_title?: Record<string, string> | string | null
  image?: unknown
}
type Transfer = {
  id: string
  number?: number | null
  source_location_id: string | null
  destination_location_id: string | null
  status: TransferStatus
  reference?: string | null
  tags?: string[] | null
  expected_arrival?: string | null
  created_at: string
  lines: TransferLine[]
}
type TransfersResp = {
  inventoryTransfers: {
    success: boolean
    data: Transfer[]
    meta: { total: number; page: number; limit: number; total_pages: number }
  }
}
type LocationsResp = {
  inventoryLocations: { data: Array<{ id: string; name: string }> }
}
type TransferStats = {
  window_days: number
  total_ordered: number
  total_shipped: number
  total_received: number
  total_rejected: number
  unique_skus: number
  acceptance_rate: number
}
type StatsResp = { inventoryTransferStats: { data: TransferStats } }

export function TransfersListPage() {
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const router = useRouter()
  const t = useTranslations("transfers")
  const tList = useTranslations("transfers.list")
  const tToast = useTranslations("transfers.toast")
  const locale = useLocale()

  const [filter, setFilter] = useState<FilterValue>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [tagsMode, setTagsMode] = useState<"add" | "remove" | null>(null)

  const { data: locsData } = useSuspenseQuery<LocationsResp>(
    GET_INVENTORY_LOCATIONS,
  )
  const locations = locsData?.inventoryLocations?.data ?? []
  const locName = (id: string | null | undefined) =>
    id
      ? (locations.find((l) => l.id === id)?.name ?? id.slice(0, 6))
      : t("unspecified")

  const { data, loading, refetch } = useQuery<TransfersResp>(
    GET_INVENTORY_TRANSFERS,
    {
      variables: {
        ...filterToVars(filter),
        search: search.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      },
      fetchPolicy: "cache-and-network",
    },
  )
  const { data: statsData } = useQuery<StatsResp>(GET_INVENTORY_TRANSFER_STATS, {
    variables: { days: 30 },
    fetchPolicy: "cache-and-network",
  })
  const stats = statsData?.inventoryTransferStats?.data

  const allRows = data?.inventoryTransfers?.data ?? []
  const meta = data?.inventoryTransfers?.meta
  const transfers = showSelectedOnly
    ? allRows.filter((tr) => selected.has(tr.id))
    : allRows
  const isPristineEmpty =
    !loading && allRows.length === 0 && filter === "all" && !search.trim()

  const [update, { loading: applyingTags }] = useMutation(
    UPDATE_INVENTORY_TRANSFER,
  )

  const selectedRows = allRows.filter((tr) => selected.has(tr.id))
  const selectedExistingTags = useMemo(
    () => [...new Set(selectedRows.flatMap((tr) => tr.tags ?? []))],
    [selectedRows],
  )

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allSelected =
    allRows.length > 0 && allRows.every((tr) => selected.has(tr.id))
  const someSelected = allRows.some((tr) => selected.has(tr.id))
  const toggleAll = () =>
    setSelected((s) => {
      if (allRows.every((tr) => s.has(tr.id))) return new Set()
      return new Set(allRows.map((tr) => tr.id))
    })

  async function applyTags(tags: string[]) {
    if (!tagsMode || tags.length === 0) return
    const targets = selectedRows.filter((tr) => tr.status !== "CANCELLED")
    await Promise.all(
      targets.map((tr) => {
        const current = tr.tags ?? []
        const next =
          tagsMode === "add"
            ? [
                ...current,
                ...tags.filter(
                  (x) =>
                    !current.some((c) => c.toLowerCase() === x.toLowerCase()),
                ),
              ]
            : current.filter(
                (c) => !tags.some((x) => x.toLowerCase() === c.toLowerCase()),
              )
        // Skip the write when nothing changed. In both modes the result can
        // only keep or shrink/grow the set against `current`; a length match
        // means a no-op (add: every tag already present · remove: none matched).
        if (next.length === current.length) return null
        return update({ variables: { input: { id: tr.id, tags: next } } })
      }),
    )
    setTagsMode(null)
    setSelected(new Set())
    setShowSelectedOnly(false)
    void refetch()
    sileo.success({ title: tToast("tagsUpdated") })
  }

  const onFilterChange = (v: FilterValue) => {
    setFilter(v)
    setPage(1)
  }
  const onSearchChange = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-heading text-xl font-semibold">
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          {t("title")}
        </h1>
        {shopSlug && (
          <Button
            nativeButton={false}
            size={"sm"}
            render={
              <Link
                href={`/store/${shopSlug}/products/inventory/transfers/new`}
              />
            }
          >
            {t("createTransfer")}
          </Button>
        )}
      </div>

      {stats && <KpiCarousel stats={stats} locale={locale} />}

      {isPristineEmpty ? (
        <EmptyState
          illustration={<TransfersIllustration className="size-40" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            shopSlug && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/store/${shopSlug}/products/inventory/transfers/new`}
                  />
                }
              >
                <Plus className="size-4" />
                {t("createTransfer")}
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {/* Toolbar */}
          {someSelected ? (
            <DataTableSelectionBar>
              <span className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onCheckedChange={toggleAll}
                />
                {tList("selectedCount", { count: selected.size })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagsMode("add")}
              >
                {tList("addTags")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagsMode("remove")}
              >
                {tList("removeTags")}
              </Button>
              <label className="ms-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Switch
                  checked={showSelectedOnly}
                  onCheckedChange={setShowSelectedOnly}
                />
                {tList("showAllSelected")}
              </label>
            </DataTableSelectionBar>
          ) : (
            <DataTableToolbar
              leading={
                <DataTableViewTabs aria-label={tList("searchAndFilter")}>
                  {FILTERS.map((f) => (
                    <DataTableViewTab
                      key={f}
                      selected={filter === f}
                      onClick={() => onFilterChange(f)}
                    >
                      {t(`filter.${f}` as never)}
                    </DataTableViewTab>
                  ))}
                </DataTableViewTabs>
              }
              search={
                <DataTableSearch
                  value={search}
                  onChange={onSearchChange}
                  placeholder={tList("searchAndFilter")}
                />
              }
            />
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tList("colTransfer")}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tList("colOrigin")}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tList("colDestination")}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tList("colStatus")}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tList("colReceived")}
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tList("colExpectedArrival")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && allRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center">
                      <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                )}
                {!loading && transfers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-sm text-muted-foreground"
                    >
                      {t("noMatchTitle")}
                    </td>
                  </tr>
                )}
                {transfers.map((tr) => {
                  const total = tr.lines.reduce((s, l) => s + l.quantity, 0)
                  const received = tr.lines.reduce(
                    (s, l) => s + l.received_quantity,
                    0,
                  )
                  const href = shopSlug
                    ? `/store/${shopSlug}/products/inventory/transfers/${tr.id}`
                    : "#"
                  const isSelected = selected.has(tr.id)
                  return (
                    <tr
                      key={tr.id}
                      onClick={() => router.push(href)}
                      className={cn(
                        "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40",
                        isSelected && "bg-muted/30",
                      )}
                    >
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(tr.id)}
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {formatTransferNumber(tr.number, tr.id)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {locName(tr.source_location_id)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {locName(tr.destination_location_id)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={tr.status} />
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ReceivedCell
                          transfer={tr}
                          received={received}
                          total={total}
                          locale={locale}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {tr.expected_arrival
                          ? new Date(tr.expected_arrival).toLocaleDateString(
                              locale,
                              { month: "short", day: "numeric", year: "numeric" },
                            )
                          : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {meta && meta.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                {t("pagedOf", {
                  from: Math.min((page - 1) * PAGE_SIZE + 1, meta.total),
                  to: Math.min(page * PAGE_SIZE, meta.total),
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
                  {t("previous")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPage((p) => Math.min(meta.total_pages, p + 1))
                  }
                  disabled={page >= meta.total_pages}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isPristineEmpty && (
        <p className="py-2 text-center text-sm font-medium text-muted-foreground">
          {t("learnMore")}
        </p>
      )}

      <BulkTagsDialog
        open={tagsMode !== null}
        onOpenChange={(o) => !o && setTagsMode(null)}
        mode={tagsMode ?? "add"}
        existingTags={selectedExistingTags}
        applying={applyingTags}
        onApply={applyTags}
      />
    </div>
  )
}

function ReceivedCell({
  transfer,
  received,
  total,
  locale,
}: {
  transfer: Transfer
  received: number
  total: number
  locale: string
}) {
  const tList = useTranslations("transfers.list")
  const isTransferred = transfer.status === "RECEIVED"
  return (
    <HoverCard>
      <HoverCardTrigger
        render={(p) => (
          <button
            {...p}
            className="tabular-nums hover:underline"
            type="button"
          >
            {tList("receivedOf", { received, total })}
          </button>
        )}
      />
      <HoverCardContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
              isTransferred
                ? "bg-muted text-foreground/80"
                : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                isTransferred
                  ? "bg-foreground/70"
                  : "ring-2 ring-sky-500 ring-inset",
              )}
            />
            {isTransferred
              ? tList("receivedN", { count: received })
              : tList("inTransitN", { count: total - received })}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {shipmentLabel(transfer.number, transfer.id)}
          </span>
        </div>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto p-2">
          {transfer.lines.map((l) => {
            const name =
              typeof l.product_name === "string"
                ? l.product_name
                : l.product_name
                  ? (l.product_name[locale] ??
                    Object.values(l.product_name)[0])
                  : "—"
            const thumb = imageThumb(l.image)
            return (
              <div key={l.id} className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <span className="flex-1 truncate text-sm">{name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {tList("receivedOf", {
                    received: l.received_quantity,
                    total: l.quantity,
                  })}
                </span>
              </div>
            )
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/** Shopify's horizontally-scrollable KPI strip with a leading "30 days" card. */
function KpiCarousel({
  stats,
  locale,
}: {
  stats: TransferStats
  locale: string
}) {
  const t = useTranslations("transfers.kpi")
  const tRoot = useTranslations("transfers")
  const scroller = useRef<HTMLDivElement>(null)
  const num = (n: number) => n.toLocaleString(locale)
  const scroll = (dir: 1 | -1) =>
    scroller.current?.scrollBy({ left: dir * 320, behavior: "smooth" })

  const cards = [
    {
      label: t("acceptanceRate"),
      value: `${num(Math.round(stats.acceptance_rate * 100))}%`,
      sub: t("acceptanceRateSub"),
    },
    {
      label: t("totalShipped"),
      value: num(stats.total_shipped),
      sub: t("totalShippedSub"),
    },
    {
      label: t("totalReceived"),
      value: num(stats.total_received),
      sub: t("totalReceivedSub"),
    },
    {
      label: t("totalOrdered"),
      value: num(stats.total_ordered),
      sub: t("totalOrderedSub"),
    },
    {
      label: t("uniqueSkus"),
      value: num(stats.unique_skus),
      sub: t("uniqueSkusSub"),
    },
  ]

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <div
        ref={scroller}
        className="flex gap-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="sticky start-0 z-10 flex w-32 shrink-0 items-center gap-2 border-e border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground">
          <CalendarDays className="size-4" />
          {t("window", { days: stats.window_days })}
        </div>
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={cn(
              "w-56 shrink-0 px-4 py-3",
              i < cards.length - 1 && "border-e border-border",
            )}
          >
            <div className="text-sm font-medium text-foreground">{c.label}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-heading text-xl font-semibold tabular-nums">
                {c.value}
              </span>
              <span className="truncate text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                {c.sub}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center gap-1 bg-gradient-to-l from-card via-card/90 to-transparent ps-6 pe-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          variant="outline"
          size="icon-sm"
          className="pointer-events-auto rounded-full"
          onClick={() => scroll(-1)}
          aria-label={tRoot("previous")}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="pointer-events-auto rounded-full"
          onClick={() => scroll(1)}
          aria-label={tRoot("next")}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}
