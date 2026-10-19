"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useSuspenseQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeftRight,
  Search,
  X,
  Download,
  ScanLine,
} from "lucide-react"
import { sileo } from "sileo"
import {
  CREATE_INVENTORY_TRANSFER,
  UPDATE_INVENTORY_TRANSFER,
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_ITEMS,
  GET_SUPPLIERS,
} from "@/features/inventory/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Card, CardContent } from "@repo/ui/components/card"
import { cn } from "@/shared/lib/utils"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { LineItemCell } from "./transfer-helpers"
import { FlowBar, LocationPill, LocationPicker } from "./location-flow"
import { DetailsCard } from "./details-card"
import { AddProductsDialog, type PickItem } from "./add-products-dialog"

type Variant = { id: string; title: Record<string, string> | string }
type Product = {
  id: string
  name: Record<string, string> | string
  product_type: "SIMPLE" | "VARIABLE"
  image: { thumbnail?: string } | null
  variation_options: Variant[] | null
}

type LineDraft = {
  key: string
  product_id: string | null
  variation_option_id: string | null
  product_name?: Record<string, string> | string | null
  variant_title?: Record<string, string> | string | null
  image?: unknown
  sku?: string | null
  quantity: number
}

export type ExistingTransfer = {
  id: string
  status?: string | null
  source_location_id: string | null
  destination_location_id: string | null
  reference?: string | null
  note?: string | null
  tags?: string[] | null
  created_at?: string
  lines: Array<{
    product_id?: string | null
    variation_option_id?: string | null
    product_name?: Record<string, string> | string | null
    variant_title?: Record<string, string> | string | null
    image?: unknown
    sku?: string | null
    quantity: number
  }>
}

const lineKey = (productId?: string | null, variationId?: string | null) =>
  `${productId ?? ""}:${variationId ?? ""}`

type ItemRow = {
  product_id: string
  variation_option_id?: string | null
  available: number
}
function availabilityMap(rows?: ItemRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows ?? []) {
    if (r.variation_option_id) m.set(`v:${r.variation_option_id}`, r.available)
    else m.set(`p:${r.product_id}`, r.available)
  }
  return m
}
const availFor = (
  m: Map<string, number>,
  l: { product_id: string | null; variation_option_id: string | null },
) =>
  l.variation_option_id
    ? (m.get(`v:${l.variation_option_id}`) ?? 0)
    : (m.get(`p:${l.product_id}`) ?? 0)

/**
 * Shopify-parity create/edit transfer. Single-column layout: an editable
 * origin → in-transit → destination rail, a product picker that opens the "Add
 * products" modal, inline Move quantities with per-endpoint impact, and the
 * shared date/reference/note/tags details card — all behind a contextual
 * "Unsaved changes" save bar.
 */
export function TransferForm({
  mode,
  transfer,
}: {
  mode: "create" | "edit"
  transfer?: ExistingTransfer
}) {
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("transfers.form")
  const tRoot = useTranslations("transfers")
  const tProd = useTranslations("transfers.productsTable")
  const tToast = useTranslations("transfers.toast")
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const { data: locsData } = useSuspenseQuery<{
    inventoryLocations: { data: Array<{ id: string; name: string }> }
  }>(GET_INVENTORY_LOCATIONS)
  const locations = locsData?.inventoryLocations?.data ?? []
  const defaultLocId = locations[0]?.id ?? ""

  const { data: productsData } = useSuspenseQuery<{
    products: { data: Product[] }
  }>(GET_PRODUCTS, { variables: { filters: { page: 1, limit: 50 } } })
  const products = productsData?.products?.data ?? []

  const { data: suppliersData } = useQuery<{
    suppliers: { data: Array<{ id: string; name: string }> }
  }>(GET_SUPPLIERS, { variables: { page: 1, limit: 100 } })
  const suppliers = suppliersData?.suppliers?.data ?? []

  const locked =
    mode === "edit" && !!transfer?.status && transfer.status !== "DRAFT"

  // ── State ────────────────────────────────────────────────────────────────
  const initialSource = transfer
    ? transfer.source_location_id
    : (defaultLocId || null)
  const initialDest = transfer
    ? transfer.destination_location_id
    : (locations[1]?.id ?? null)

  const [source, setSource] = useState<string | null>(initialSource)
  const [sourceLabel, setSourceLabel] = useState<string | null>(null)
  const [destination, setDestination] = useState<string | null>(initialDest)
  const [destLabel, setDestLabel] = useState<string | null>(null)
  const [reference, setReference] = useState(transfer?.reference ?? "")
  const [note, setNote] = useState(transfer?.note ?? "")
  const [tags, setTags] = useState<string[]>(() =>
    [...(transfer?.tags ?? [])].sort(),
  )
  const [lines, setLines] = useState<LineDraft[]>(
    () =>
      transfer?.lines.map((l) => ({
        key: lineKey(l.product_id, l.variation_option_id),
        product_id: l.product_id ?? null,
        variation_option_id: l.variation_option_id ?? null,
        product_name: l.product_name,
        variant_title: l.variant_title,
        image: l.image,
        sku: l.sku,
        quantity: l.quantity,
      })) ?? [],
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── Availability (source + destination) for impact + the picker columns ───
  const realSource = source
  const realDest = destination
  const sourceItems = useQuery<{ inventoryItems: { data: ItemRow[] } }>(
    GET_INVENTORY_ITEMS,
    {
      variables: { location_id: realSource ?? "", page: 1, limit: 200 },
      skip: !realSource,
      fetchPolicy: "cache-and-network",
    },
  )
  const destItems = useQuery<{ inventoryItems: { data: ItemRow[] } }>(
    GET_INVENTORY_ITEMS,
    {
      variables: { location_id: realDest ?? "", page: 1, limit: 200 },
      skip: !realDest,
      fetchPolicy: "cache-and-network",
    },
  )
  const sourceAvail = useMemo(
    () => availabilityMap(sourceItems.data?.inventoryItems?.data),
    [sourceItems.data],
  )
  const destAvail = useMemo(
    () => availabilityMap(destItems.data?.inventoryItems?.data),
    [destItems.data],
  )

  // ── Dirty tracking for the save bar ───────────────────────────────────────
  const snapshot = JSON.stringify({
    source,
    sourceLabel,
    destination,
    destLabel,
    reference,
    note,
    tags,
    lines: lines.map((l) => [l.key, l.quantity]),
  })
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        source: initialSource,
        sourceLabel: null,
        destination: initialDest,
        destLabel: null,
        reference: transfer?.reference ?? "",
        note: transfer?.note ?? "",
        tags: [...(transfer?.tags ?? [])].sort(),
        lines: (transfer?.lines ?? []).map((l) => [
          lineKey(l.product_id, l.variation_option_id),
          l.quantity,
        ]),
      }),
    // initial snapshot is fixed for the lifetime of the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const dirty = snapshot !== initialSnapshot

  const existingKeys = useMemo(
    () => new Set(lines.map((l) => l.key)),
    [lines],
  )

  function addLines(items: PickItem[]) {
    setLines((s) => {
      const have = new Set(s.map((l) => l.key))
      const next = [...s]
      for (const it of items) {
        const key = lineKey(it.product_id, it.variation_option_id)
        if (have.has(key)) continue
        have.add(key)
        next.push({ ...it, key, quantity: 1 })
      }
      return next
    })
  }
  const setQty = (key: string, n: number) =>
    setLines((s) =>
      s.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, n) } : l)),
    )
  const removeLine = (key: string) =>
    setLines((s) => s.filter((l) => l.key !== key))

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [create, createState] = useMutation<{
    createInventoryTransfer: { data?: { id: string } | null }
  }>(CREATE_INVENTORY_TRANSFER, {
    onCompleted: (resp) => {
      sileo.success({ title: tToast("created") })
      const id = resp?.createInventoryTransfer?.data?.id
      if (shopSlug && id)
        router.push(`/store/${shopSlug}/products/inventory/transfers/${id}`)
    },
    onError: (err) => {
      sileo.error({ title: err.message })
      setBarError(err.message)
    },
  })
  const [update, updateState] = useMutation(UPDATE_INVENTORY_TRANSFER, {
    onCompleted: () => {
      sileo.success({ title: tToast("updated") })
      if (shopSlug && transfer)
        router.push(
          `/store/${shopSlug}/products/inventory/transfers/${transfer.id}`,
        )
    },
    onError: (err) => {
      sileo.error({ title: err.message })
      setBarError(err.message)
    },
  })
  const saving = createState.loading || updateState.loading

  function discard() {
    setSource(initialSource)
    setSourceLabel(null)
    setDestination(initialDest)
    setDestLabel(null)
    setReference(transfer?.reference ?? "")
    setNote(transfer?.note ?? "")
    setTags([...(transfer?.tags ?? [])].sort())
    setBarError(null)
    setLines(
      transfer?.lines.map((l) => ({
        key: lineKey(l.product_id, l.variation_option_id),
        product_id: l.product_id ?? null,
        variation_option_id: l.variation_option_id ?? null,
        product_name: l.product_name,
        variant_title: l.variant_title,
        image: l.image,
        sku: l.sku,
        quantity: l.quantity,
      })) ?? [],
    )
  }

  function submit() {
    setBarError(null)
    const shipment = {
      reference: reference.trim() || null,
      note: note.trim() || null,
      tags,
    }
    if (locked && transfer) {
      void update({ variables: { input: { id: transfer.id, ...shipment } } })
      return
    }
    if (!source && !destination) {
      sileo.error({ title: t("pickEndpoint") })
      return
    }
    if (source && destination && source === destination) {
      sileo.error({ title: t("mustDiffer") })
      return
    }
    if (lines.length === 0) {
      sileo.error({ title: t("addLine") })
      return
    }
    const payloadLines = lines.map((l) => ({
      product_id: l.product_id ?? null,
      variation_option_id: l.variation_option_id ?? null,
      quantity: l.quantity,
    }))
    const input = {
      source_location_id: source,
      destination_location_id: destination,
      ...shipment,
      lines: payloadLines,
    }
    if (mode === "edit" && transfer) {
      void update({ variables: { input: { id: transfer.id, ...input } } })
    } else {
      void create({ variables: { input } })
    }
  }

  // Drive the global navbar contextual save bar (same as the detail page). In
  // create mode it's always available so a new transfer can be saved; in edit
  // mode it appears once the form is dirty. Re-runs on `snapshot` so Save closes
  // over the latest state.
  const barVisible = dirty || mode === "create"
  useEffect(() => {
    if (!barVisible) {
      hideBar()
      return
    }
    showBar({
      label: tRoot("unsavedChanges"),
      saving,
      onSave: submit,
      onDiscard: mode === "create" ? () => router.back() : discard,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barVisible, saving, snapshot])
  useEffect(() => () => hideBar(), [hideBar])

  if (locations.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumb shopSlug={shopSlug} title={tRoot("title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <h2 className="font-heading text-lg font-semibold">
              {t("needTwoLocationsTitle")}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("needTwoLocationsDescription")}
            </p>
            {shopSlug && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/store/${shopSlug}/products/inventory/locations`}
                  />
                }
              >
                {t("manageLocations")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const suppliersHref = shopSlug
    ? `/store/${shopSlug}/products/inventory/suppliers`
    : undefined

  const today = transfer?.created_at ? new Date(transfer.created_at) : new Date()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        {shopSlug && (
          <Link
            href={`/store/${shopSlug}/products/inventory/transfers`}
            className="text-muted-foreground hover:text-foreground"
            aria-label={tRoot("title")}
          >
            <ArrowLeftRight className="size-5" />
          </Link>
        )}
        <h1 className="font-heading text-2xl font-semibold">
          {mode === "edit" ? t("editTitle") : t("createTitle")}
        </h1>
      </div>

      {locked && (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("lockedNote")}
        </p>
      )}

      {/* Location rail + products */}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b border-border p-3">
          <FlowBar
            origin={
              locked ? (
                <LocationPill label={resolveName(source, locations, sourceLabel, tRoot("unspecified"))} />
              ) : (
                <LocationPicker
                  value={source}
                  label={sourceLabel}
                  onChange={(v, l) => {
                    setSource(v)
                    setSourceLabel(l ?? null)
                  }}
                  locations={locations}
                  suppliers={suppliers}
                  placeholder={tRoot("flow.selectOrigin")}
                  excludeId={destination}
                  suppliersHref={suppliersHref}
                />
              )
            }
            destination={
              locked ? (
                <LocationPill label={resolveName(destination, locations, destLabel, tRoot("unspecified"))} />
              ) : (
                <LocationPicker
                  value={destination}
                  label={destLabel}
                  onChange={(v, l) => {
                    setDestination(v)
                    setDestLabel(l ?? null)
                  }}
                  locations={locations}
                  suppliers={suppliers}
                  placeholder={tRoot("flow.selectDestination")}
                  excludeId={source}
                  suppliersHref={suppliersHref}
                />
              )
            }
          />
        </div>

        {!locked && (
          <div className="flex items-center gap-2 border-b border-border p-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="relative flex-1"
            >
              <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <div className="flex h-9 items-center rounded-lg border border-input bg-background ps-9 pe-3 text-start text-sm text-muted-foreground">
                {tProd("searchToAdd")}
              </div>
            </button>
            <DecorIcon icon={<Download className="size-4" />} label={tProd("import")} />
            <DecorIcon icon={<ScanLine className="size-4" />} label={tProd("scan")} />
          </div>
        )}

        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-start font-medium">
                    {tProd("title")}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium">
                    {tProd("move")}
                  </th>
                  <th className="px-3 py-2.5 text-end font-medium">
                    {source ? resolveName(source, locations, sourceLabel, tRoot("unspecified")) : "—"}
                  </th>
                  <th className="px-3 py-2.5 text-end font-medium">
                    {destination ? resolveName(destination, locations, destLabel, tRoot("unspecified")) : "—"}
                  </th>
                  {!locked && <th className="w-10 px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const src = availFor(sourceAvail, l)
                  const dst = availFor(destAvail, l)
                  const afterSrc = src - l.quantity
                  return (
                    <tr key={l.key} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3">
                        <LineItemCell line={l} locale={locale} compact />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Input
                          type="number"
                          min={1}
                          value={l.quantity}
                          disabled={locked}
                          onChange={(e) => setQty(l.key, Number(e.target.value) || 1)}
                          className="mx-auto h-8 w-20 text-center tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-3 text-end tabular-nums">
                        {source ? (
                          <Impact from={src} to={afterSrc} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-end tabular-nums">
                        {destination ? (
                          <Impact from={dst} to={dst + l.quantity} positive />
                        ) : (
                          "—"
                        )}
                      </td>
                      {!locked && (
                        <td className="px-3 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(l.key)}
                            aria-label={t("cancel")}
                          >
                            <X className="size-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details card */}
      <DetailsCard
        date={today}
        reference={reference}
        onChangeReference={setReference}
        note={note}
        onChangeNote={setNote}
        tags={tags}
        onChangeTags={(v) => setTags([...v].sort())}
        locale={locale}
      />

      {!locked && (
        <AddProductsDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          products={products}
          existingKeys={existingKeys}
          availOrigin={(item) => availFor(sourceAvail, item)}
          availDest={(item) => availFor(destAvail, item)}
          locale={locale}
          onAdd={addLines}
        />
      )}
    </div>
  )
}

function resolveName(
  id: string | null,
  locations: Array<{ id: string; name: string }>,
  label: string | null,
  unspecified: string,
): string {
  if (id) return locations.find((l) => l.id === id)?.name ?? id.slice(0, 6)
  if (label) return label
  return unspecified
}

function Breadcrumb({
  shopSlug,
  title,
}: {
  shopSlug: string | null
  title: string
}) {
  if (!shopSlug) return null
  return (
    <Link
      href={`/store/${shopSlug}/products/inventory/transfers`}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftRight className="size-3.5" />
      {title}
    </Link>
  )
}

function DecorIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Button variant="outline" size="icon" aria-label={label} title={label}>
      {icon}
    </Button>
  )
}

function Impact({
  from,
  to,
  positive = false,
}: {
  from: number
  to: number
  positive?: boolean
}) {
  const negative = !positive && to < 0
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span className="text-muted-foreground">{from}</span>
      <span className="text-muted-foreground rtl:rotate-180">→</span>
      <span
        className={cn(
          negative
            ? "text-destructive"
            : positive
              ? "font-medium text-emerald-600"
              : "font-medium",
        )}
      >
        {to}
      </span>
    </span>
  )
}
