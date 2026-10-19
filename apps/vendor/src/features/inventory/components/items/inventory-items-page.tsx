"use client"

import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import Image from "@/shared/components/app-image"
import { useParams } from "next/navigation"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import {
  useApolloClient,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@apollo/client/react"
import {
  Store,
  Download,
  Upload,
  Columns3,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
  Image as ImageIcon,
  Check,
  X,
  FilePlus2,
} from "lucide-react"
import { sileo } from "sileo"
import {
  GET_INVENTORY_ITEMS,
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_HISTORY,
  EDIT_INVENTORY_STOCK,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@repo/ui/components/dropdown-menu"
import { EmptyState, EmptyStateInline } from "@/shared/components/empty-state"
import { InventoryIllustration } from "@/features/inventory/components/empty-illustrations"
import { cn } from "@/shared/lib/utils"
import {
  DataTableFooter,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"

type InventoryStockStatus = "ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK"

type InventoryItem = {
  product_id: string
  product_slug: string
  variation_option_id?: string | null
  name: Record<string, string> | string
  variant_title?: Record<string, string> | string | null
  image?: { thumbnail?: string; original?: string } | null
  sku?: string | null
  unavailable: number
  committed: number
  available: number
  on_hand: number
  incoming: number
  unavailable_damaged: number
  unavailable_quality_control: number
  unavailable_safety_stock: number
  unavailable_other: number
  low_stock_threshold?: number | null
  is_low_stock?: boolean
  is_out_of_stock?: boolean
  safety_stock?: number
}

type ItemsResp = {
  inventoryItems: {
    success: boolean
    data: InventoryItem[]
    meta: {
      total: number
      page: number
      limit: number
      total_pages: number
      low_stock_count?: number
      out_of_stock_count?: number
    }
  }
}

type Location = {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
}
type LocationsResp = {
  inventoryLocations: { success: boolean; data: Location[] }
}

type ColumnKey =
  | "sku"
  | "unavailable"
  | "committed"
  | "available"
  | "on_hand"
  | "incoming"

const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = {
  sku: true,
  unavailable: true,
  committed: true,
  available: true,
  on_hand: true,
  incoming: true,
}

type Bucket =
  | "available"
  | "damaged"
  | "quality_control"
  | "safety_stock"
  | "other"
type Mode = "set" | "adjust"

// Bucket labels live in `inventory.items.bucket.<Bucket>`.

// Shopify's optional audit-reason list (the "Add reason" dropdown). Each id is
// a key under `inventory.items.reason`; the translated label is what gets
// stored as the adjustment note for the history view, so the note reads in the
// language the merchant picked it in. The bucket above drives where the stock
// actually moves.
const ADJUST_REASONS = [
  "correction",
  "count",
  "received",
  "returnRestock",
  "damaged",
  "theftOrLoss",
  "promotionOrDonation",
] as const
type AdjustReason = (typeof ADJUST_REASONS)[number]

// One staged edit (Shopify "Unsaved changes" model). Keyed by row key.
type PendingEdit = {
  mode: Mode
  bucket: Bucket
  value: number
  reason?: AdjustReason
}

/**
 * Shopify "Inventory" page with the full editing experience:
 *  - Click an editable cell (Available / On hand) → inline editor popover with
 *    Set to / Adjust by, a quantity stepper, and a bucket selector
 *    (Shop location, Damaged, Quality control, Safety stock, Other).
 *  - Confirming stages the edit (cell shows `60 → 66` preview); a top bar
 *    surfaces "Unsaved changes" with Discard / Save.
 *  - Unavailable cell → popover breaking the count into the four buckets.
 *  - Committed cell → popover (no unfulfilled-orders detail yet, shows count).
 */
export function InventoryItemsPage() {
  const t = useTranslations("inventory")
  const locale = useLocale()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const apollo = useApolloClient()

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [locationId, setLocationId] = useState<string | "all">("all")
  const [status, setStatus] = useState<InventoryStockStatus>("ALL")
  const [visible, setVisible] =
    useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE)

  const { data: locsData } =
    useSuspenseQuery<LocationsResp>(GET_INVENTORY_LOCATIONS)
  const locations = locsData?.inventoryLocations?.data ?? []
  const defaultLoc = locations.find((l) => l.is_default) ?? locations[0]

  const { data, loading } = useQuery<ItemsResp>(GET_INVENTORY_ITEMS, {
    variables: {
      search: search.trim() || undefined,
      location_id: locationId === "all" ? undefined : locationId,
      status: status === "ALL" ? undefined : status,
      page,
      limit: 25,
    },
    fetchPolicy: "cache-and-network",
  })

  const items = data?.inventoryItems?.data ?? []
  const meta = data?.inventoryItems?.meta
  // No tracked products anywhere (vs. filtered/searched to zero).
  const isPristineEmpty =
    !loading &&
    items.length === 0 &&
    !search.trim() &&
    locationId === "all" &&
    status === "ALL"

  // Staged edits keyed by row key.
  const [pending, setPending] = useState<Record<string, PendingEdit>>({})
  const pendingCount = Object.keys(pending).length

  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const [editStock, { loading: saving }] = useMutation(EDIT_INVENTORY_STOCK)

  function stageEdit(key: string, edit: PendingEdit) {
    setBarError(null)
    setPending((s) => ({ ...s, [key]: edit }))
  }
  function discardEdit(key: string) {
    setBarError(null)
    setPending((s) => {
      const next = { ...s }
      delete next[key]
      return next
    })
  }
  function discardAll() {
    setBarError(null)
    setPending({})
  }

  async function saveAll() {
    const targetLocId = locationId === "all" ? defaultLoc?.id : locationId
    if (!targetLocId) {
      const msg = t("items.noLocationSelected")
      sileo.error({ title: msg })
      setBarError(msg)
      return
    }
    setBarError(null)
    try {
      for (const [key, edit] of Object.entries(pending)) {
        const [productId, variationId] = key.split(":")
        await editStock({
          variables: {
            input: {
              location_id: targetLocId,
              product_id: variationId ? null : productId || null,
              variation_option_id: variationId || null,
              bucket: edit.bucket,
              mode: edit.mode,
              value: edit.value,
              // Optional audit reason → stored as the adjustment note.
              note: edit.reason ? t(`items.reason.${edit.reason}`) : undefined,
            },
          },
        })
      }
      sileo.success({ title: t("items.updated") })
      setPending({})
      void apollo.refetchQueries({
        include: [GET_INVENTORY_ITEMS, GET_INVENTORY_HISTORY],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("items.saveFailed")
      sileo.error({
        title: msg,
      })
      setBarError(msg)
    }
  }

  // Register / update the global save bar (in the navbar search area) while there are pending edits
  useEffect(() => {
    if (pendingCount === 0) {
      hideBar()
      return
    }
    showBar({
      label: t("items.unsavedCount", { count: pendingCount }),
      saving,
      onSave: saveAll,
      onDiscard: discardAll,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, saving, pending, locationId, defaultLoc])

  useEffect(() => () => hideBar(), [hideBar])

  useLeaveGuard({
    when: pendingCount > 0,
    onLeave: () => {
      discardAll()
      hideBar()
    },
  })

  const totalRows = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-muted-foreground" />
          <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">

          <Button variant="outline" size="sm" disabled>
            <Download className="size-4" />
            {t("export")}
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Upload className="size-4" />
            {t("import")}
          </Button>
        </div>
      </div>

      {isPristineEmpty ? (
        <EmptyState
          illustration={<InventoryIllustration className="size-40" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            shopSlug && (
              <Button
                nativeButton={false}
                render={<Link href={`/store/${shopSlug}/products`} />}
              >
                {t("goToProducts")}
              </Button>
            )
          }
          footer={t("learnMore")}
        />
      ) : (
      <>
      {/* Toolbar */}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <DataTableToolbar
          leading={
            <>
              <DataTableViewTabs aria-label={t("stockAria")}>
                <DataTableViewTab
                  selected={status === "ALL"}
                  onClick={() => {
                    setStatus("ALL")
                    setPage(1)
                    discardAll()
                  }}
                >
                  {t("allItems")}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {status === "ALL" ? totalRows : meta?.total ?? 0}
                  </span>
                </DataTableViewTab>
                <DataTableViewTab
                  selected={status === "LOW_STOCK"}
                  onClick={() => {
                    setStatus("LOW_STOCK")
                    setPage(1)
                    discardAll()
                  }}
                >
                  {t("lowStock")}
                  {meta?.low_stock_count !== undefined &&
                    meta.low_stock_count > 0 && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {meta.low_stock_count}
                      </span>
                    )}
                </DataTableViewTab>
                <DataTableViewTab
                  selected={status === "OUT_OF_STOCK"}
                  onClick={() => {
                    setStatus("OUT_OF_STOCK")
                    setPage(1)
                    discardAll()
                  }}
                >
                  {t("outOfStock")}
                  {meta?.out_of_stock_count !== undefined &&
                    meta.out_of_stock_count > 0 && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {meta.out_of_stock_count}
                      </span>
                    )}
                </DataTableViewTab>
              </DataTableViewTabs>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={(triggerProps) => (
                    <Button
                      {...triggerProps}
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2.5"
                    >
                      {locationId === "all"
                        ? t("allLocations")
                        : locations.find((l) => l.id === locationId)?.name ??
                          t("allLocations")}
                      <ChevronDown className="size-3.5" />
                    </Button>
                  )}
                />
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("location")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={locationId}
                      onValueChange={(v) => {
                        setLocationId((v as string) ?? "all")
                        setPage(1)
                        discardAll()
                      }}
                    >
                      <DropdownMenuRadioItem value="all">
                        {t("allLocations")}
                      </DropdownMenuRadioItem>
                      {locations.map((l) => (
                        <DropdownMenuRadioItem key={l.id} value={l.id}>
                          {l.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
          search={
            <DataTableSearch
              value={search}
              onChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder={t("searchProducts")}
            />
          }
          trailing={
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(triggerProps) => (
                  <Button
                    {...triggerProps}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("columns")}
                  >
                    <Columns3 className="size-4" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(DEFAULT_VISIBLE) as ColumnKey[]).map((k) => (
                    <DropdownMenuCheckboxItem
                      key={k}
                      checked={visible[k]}
                      onCheckedChange={(v) =>
                        setVisible((s) => ({ ...s, [k]: !!v }))
                      }
                    >
                      {t(`items.col.${k}`)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card text-xs font-medium text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-2">
                  <Checkbox aria-label={t("items.selectAll")} />
                </th>
                <th className="px-2 py-2 text-start">
                  {t("items.col.product")}
                </th>
                {visible.sku && (
                  <th className="px-3 py-2 text-start font-medium">
                    {t("items.col.sku")}
                  </th>
                )}
                {visible.unavailable && (
                  <th className="px-3 py-2 text-end font-medium">
                    {t("items.col.unavailable")}
                  </th>
                )}
                {visible.committed && (
                  <th className="px-3 py-2 text-end font-medium">
                    {t("items.col.committed")}
                  </th>
                )}
                {visible.available && (
                  <th className="px-3 py-2 text-end font-medium">
                    {t("items.col.available")}
                  </th>
                )}
                {visible.on_hand && (
                  <th className="px-3 py-2 text-end font-medium">
                    {t("items.col.on_hand")}
                  </th>
                )}
                {visible.incoming && (
                  <th className="px-3 py-2 text-end font-medium">
                    {t("items.col.incoming")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyStateInline
                      title={t("items.noMatchingTitle")}
                      description={t("items.noMatchingBody")}
                    />
                  </td>
                </tr>
              )}
              {items.map((it) => {
                const key = `${it.product_id}:${it.variation_option_id ?? ""}`
                const edit = pending[key]
                const proj = edit ? projectEdit(it, edit) : null
                return (
                  <tr
                    key={key}
                    className="border-b border-border/60 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox aria-label={t("items.selectRow")} />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <ProductThumb image={it.image} />
                        <div className="min-w-0">
                          <Link
                            href={
                              shopSlug
                                ? `/store/${shopSlug}/products/${it.product_slug}/edit`
                                : "#"
                            }
                            className="truncate font-medium hover:underline"
                          >
                            {displayName(it.name, locale)}
                          </Link>
                          {it.variant_title && (
                            <div className="truncate text-xs text-muted-foreground">
                              {displayName(it.variant_title, locale)}
                            </div>
                          )}
                          {it.is_out_of_stock ? (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                                {t("outOfStock")}
                              </span>
                            </div>
                          ) : it.is_low_stock ? (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                                {t("items.lowStockBadge", {
                                  threshold: it.low_stock_threshold ?? 10,
                                })}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {visible.sku && (
                      <td className="px-3 py-2.5">
                        {it.sku ? (
                          <span className="font-mono text-xs">{it.sku}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("items.noSku")}
                          </span>
                        )}
                      </td>
                    )}
                    {visible.unavailable && (
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        <UnavailablePopover item={it} projected={proj} />
                      </td>
                    )}
                    {visible.committed && (
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        <CommittedPopover item={it} />
                      </td>
                    )}
                    {visible.available && (
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        <EditableCell
                          current={it.available}
                          projected={proj?.available ?? null}
                          locked={locationId === "all" && !defaultLoc}
                          renderEditor={(close) => (
                            <StockEditor
                              column="available"
                              item={it}
                              existing={edit}
                              onStage={(e) => stageEdit(key, e)}
                              onClear={() => discardEdit(key)}
                              onApplied={close}
                            />
                          )}
                        />
                      </td>
                    )}
                    {visible.on_hand && (
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        <EditableCell
                          current={it.on_hand}
                          projected={proj?.on_hand ?? null}
                          locked={locationId === "all" && !defaultLoc}
                          renderEditor={(close) => (
                            <StockEditor
                              column="on_hand"
                              item={it}
                              existing={edit}
                              onStage={(e) => stageEdit(key, e)}
                              onClear={() => discardEdit(key)}
                              onApplied={close}
                            />
                          )}
                        />
                      </td>
                    )}
                    {visible.incoming && (
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {it.incoming}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalRows > 0 && (
          <DataTableFooter className="text-xs text-muted-foreground">
            <span>
              {t("pagination.pagedOf", {
                from: Math.min((page - 1) * 25 + 1, totalRows),
                to: Math.min(page * 25, totalRows),
                total: totalRows,
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t("pagination.next")}
              </Button>
            </div>
          </DataTableFooter>
        )}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        {t("learnMore")}
      </div>
      </>
      )}
    </div>
  )
}

/** Projects a staged edit onto an item to compute preview counts. */
function projectEdit(item: InventoryItem, edit: PendingEdit) {
  let available = item.available
  let on_hand = item.on_hand
  let unavailable = item.unavailable

  if (edit.bucket === "available") {
    if (edit.mode === "set") {
      const delta = edit.value - item.available
      available = edit.value
      on_hand = item.on_hand + delta
    } else {
      available = item.available + edit.value
      on_hand = item.on_hand + edit.value
    }
  } else {
    // Unavailable bucket: pull from available, on_hand unchanged.
    const bucketCol =
      edit.bucket === "damaged"
        ? item.unavailable_damaged
        : edit.bucket === "quality_control"
          ? item.unavailable_quality_control
          : edit.bucket === "safety_stock"
            ? item.unavailable_safety_stock
            : item.unavailable_other
    const bucketDelta =
      edit.mode === "set" ? edit.value - bucketCol : edit.value
    available = item.available - bucketDelta
    unavailable = item.unavailable + bucketDelta
  }
  return { available, on_hand, unavailable }
}

/** A number cell that opens an editor popover and shows a `from → to` preview. */
function EditableCell({
  current,
  projected,
  renderEditor,
  locked,
}: {
  current: number
  projected: number | null
  renderEditor: (close: () => void) => React.ReactNode
  locked?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (locked) {
    return <span>{current}</span>
  }
  const changed = projected !== null && projected !== current
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(triggerProps) => (
          <button
            {...triggerProps}
            className={cn(
              "ml-auto inline-flex min-w-[3rem] cursor-pointer items-center justify-end rounded-md border border-transparent px-2.5 py-1 tabular-nums transition-all",
              "hover:border-input hover:bg-card hover:shadow-sm",
              "data-[popup-open]:border-input data-[popup-open]:bg-card data-[popup-open]:shadow-sm",
              changed && "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20",
            )}
          >
            {changed ? (
              <span>
                <span className="text-muted-foreground">{current}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {projected}
                </span>
              </span>
            ) : (
              current
            )}
          </button>
        )}
      />
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-auto max-w-[calc(100vw-2rem)] rounded-xl p-2.5 shadow-lg"
      >
        {renderEditor(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Shopify inventory editor — a single horizontal row:
 *   [ Set to ▾  60  ⇅ ]   [ Shop location  ⇅ ]   [▤+]   [✓]
 * The mode + value + vertical stepper share one light-gray group; the bucket
 * is a bordered select; "Add reason" is an icon-only button; apply is outlined.
 */
function StockEditor({
  column,
  item,
  existing,
  onStage,
  onClear,
  onApplied,
}: {
  column: "available" | "on_hand"
  item: InventoryItem
  existing?: PendingEdit
  onStage: (e: PendingEdit) => void
  onClear: () => void
  onApplied?: () => void
}) {
  const t = useTranslations("inventory.items")
  const [mode, setMode] = useState<Mode>(existing?.mode ?? "set")
  const [bucket, setBucket] = useState<Bucket>(existing?.bucket ?? "available")
  const [reason, setReason] = useState<AdjustReason | null>(
    existing?.reason ?? null,
  )
  const initial =
    existing?.value ??
    (mode === "adjust"
      ? 0
      : column === "available"
        ? item.available
        : item.on_hand)
  const [value, setValue] = useState<string>(String(initial))
  const reasonLabel = reason
    ? t("reasonLabel", { reason: t(`reason.${reason}`) })
    : t("addReason")

  function confirm() {
    const n = Number(value)
    if (!Number.isFinite(n)) {
      sileo.error({ title: t("enterNumber") })
      return
    }
    onStage({ mode, bucket, value: n, reason: reason ?? undefined })
    onApplied?.()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Combined: mode pill + value + vertical stepper */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-muted/70 px-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <button
                {...triggerProps}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-card px-2 text-[13px] font-medium text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-background"
              >
                {mode === "set" ? t("modeSet") : t("modeAdjust")}
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            )}
          />
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuRadioGroup
              value={mode}
              onValueChange={(v) => setMode((v as Mode) ?? "set")}
            >
              <DropdownMenuRadioItem value="set">
                {t("modeSet")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="adjust">
                {t("modeAdjust")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm()
            if (e.key === "ArrowUp") {
              e.preventDefault()
              setValue((v) => String((Number(v) || 0) + 1))
            }
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setValue((v) => String((Number(v) || 0) - 1))
            }
          }}
          inputMode="numeric"
          className="w-10 bg-transparent text-center text-[13px] font-medium tabular-nums focus:outline-none"
        />

        {/* Vertical stepper */}
        <div className="flex flex-col">
          <button
            type="button"
            className="flex h-3.5 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setValue((v) => String((Number(v) || 0) + 1))}
            aria-label={t("increase")}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            className="flex h-3.5 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setValue((v) => String((Number(v) || 0) - 1))}
            aria-label={t("decrease")}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>

      {/* Bucket (location / state) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(triggerProps) => (
            <button
              {...triggerProps}
              className="inline-flex h-9 min-w-[12rem] flex-1 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-[13px] transition-colors hover:bg-muted"
            >
              <span className="truncate">{t(`bucket.${bucket}`)}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        />
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuRadioGroup
            value={bucket}
            onValueChange={(v) => setBucket((v as Bucket) ?? "available")}
          >
            <DropdownMenuRadioItem value="available">
              {t("bucket.available")}
            </DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem value="damaged">
              {t("bucket.damaged")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="quality_control">
              {t("bucket.quality_control")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="safety_stock">
              {t("bucket.safety_stock")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="other">
              {t("bucket.other")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add reason — icon-only (active ring when set) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(triggerProps) => (
            <button
              {...triggerProps}
              title={reasonLabel}
              aria-label={reasonLabel}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                reason &&
                  "border-foreground/30 text-foreground ring-1 ring-foreground/20",
              )}
            >
              <FilePlus2 className="size-4" />
            </button>
          )}
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuRadioGroup
            value={reason ?? ""}
            onValueChange={(v) => setReason((v as AdjustReason) || null)}
          >
            <DropdownMenuRadioItem value="">{t("noReason")}</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {ADJUST_REASONS.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {t(`reason.${r}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Apply — outlined */}
      <button
        type="button"
        onClick={confirm}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-muted"
        aria-label={t("apply")}
      >
        <Check className="size-4" />
      </button>

      {existing && (
        <button
          type="button"
          onClick={onClear}
          title={t("clearStaged")}
          aria-label={t("clearStaged")}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Unavailable breakdown popover. */
function UnavailablePopover({
  item,
  projected,
}: {
  item: InventoryItem
  projected: { unavailable: number } | null
}) {
  const t = useTranslations("inventory.items")
  const display =
    projected && projected.unavailable !== item.unavailable
      ? projected.unavailable
      : item.unavailable
  return (
    <Popover>
      <PopoverTrigger
        render={(triggerProps) => (
          <button
            {...triggerProps}
            className="ml-auto rounded px-2 py-0.5 tabular-nums underline decoration-dotted underline-offset-4 hover:bg-muted"
          >
            {display}
          </button>
        )}
      />
      <PopoverContent align="end" className="w-56 p-3">
        <div className="mb-2 text-sm font-medium">{t("unavailableTitle")}</div>
        <div className="flex flex-col gap-1.5 text-sm">
          <Row label={t("bucket.damaged")} value={item.unavailable_damaged} />
          <Row
            label={t("bucket.quality_control")}
            value={item.unavailable_quality_control}
          />
          <Row
            label={t("bucket.safety_stock")}
            value={item.unavailable_safety_stock}
          />
          <Row label={t("bucket.other")} value={item.unavailable_other} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Committed popover — shows orders count / empty state. */
function CommittedPopover({ item }: { item: InventoryItem }) {
  const t = useTranslations("inventory.items")
  return (
    <Popover>
      <PopoverTrigger
        render={(triggerProps) => (
          <button
            {...triggerProps}
            className="ml-auto rounded px-2 py-0.5 tabular-nums underline decoration-dotted underline-offset-4 hover:bg-muted"
          >
            {item.committed}
          </button>
        )}
      />
      <PopoverContent align="end" className="w-56 p-3 text-sm">
        {item.committed > 0 ? (
          <span>{t("committedUnits", { count: item.committed })}</span>
        ) : (
          <span className="text-muted-foreground">{t("noUnfulfilled")}</span>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function ProductThumb({
  image,
}: {
  image?: { thumbnail?: string; original?: string } | null
}) {
  const url =
    typeof image === "object" && image
      ? image.thumbnail ?? image.original
      : null
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded object-cover ring-1 ring-foreground/10"
      />
    )
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground ring-1 ring-foreground/10">
      <ImageIcon className="size-4" />
    </div>
  )
}

/** A product/variant name in the dashboard's language, falling back to any. */
function displayName(
  name: Record<string, string> | string | null | undefined,
  locale: string,
): string {
  if (!name) return "—"
  if (typeof name === "string") return name
  return name[locale] ?? name.en ?? name.ar ?? Object.values(name)[0] ?? "—"
}
