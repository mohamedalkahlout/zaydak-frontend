"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useSuspenseQuery } from "@apollo/client/react"
import { ArrowLeft, Trash2, Plus, Search, Loader2, X } from "lucide-react"
import { sileo } from "sileo"
import {
  CREATE_PURCHASE_ORDER,
  GET_INVENTORY_LOCATIONS,
  GET_SUPPLIERS,
} from "@/features/inventory/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { formatMoneyCents } from "@/shared/lib/format"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Card, CardContent } from "@repo/ui/components/card"
import { Badge } from "@repo/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"

/** A product or variant name arrives either as a plain string or as the
 *  localized JSON blob the API stores it in — see `displayName` below. */
type LocalizedName = string | Record<string, string | null | undefined> | null

/** These documents are the plain `@apollo/client` `gql` tag, not the codegen
 *  one, so the result carries no type of its own — only the fields read below
 *  are declared. */
type CreatePurchaseOrderResult = {
  createPurchaseOrder?: { data?: { id: string } | null } | null
}

type Variant = {
  id: string
  title: LocalizedName
  quantity: number
  price_cents: number
}
type Product = {
  id: string
  name: LocalizedName
  product_type: "SIMPLE" | "VARIABLE"
  price_cents?: number | null
  // Nullable from the list query — guard every read.
  variation_options: Variant[] | null
}

type LineDraft = {
  key: string
  product_id?: string | null
  variation_option_id?: string | null
  label: string
  supplier_sku: string
  quantity: number
  unit_cost_cents: number
  tax_percent_bps: number | null
}

/**
 * Shopify-parity "Create purchase order" page. Adds (over the v1 build):
 *   - Supplier payment terms + currency picker
 *   - Shipping carrier free-form field
 *   - Tags
 *   - Per-line supplier SKU and tax % override
 *
 * Payment-term labels live in `inventory.purchaseOrders.paymentTerms.<value>`.
 */
const PAYMENT_TERMS = [
  "NONE",
  "CASH_ON_DELIVERY",
  "PAYMENT_ON_RECEIPT",
  "PAYMENT_IN_ADVANCE",
  "NET_7",
  "NET_15",
  "NET_30",
  "NET_45",
  "NET_60",
] as const

const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "AED",
  "EGP",
  "JOD",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
] as const

export function PurchaseOrderNewPage() {
  const t = useTranslations("inventory.purchaseOrderNew")
  const tPo = useTranslations("inventory.purchaseOrders")
  const tInv = useTranslations("inventory")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const router = useRouter()

  const { data: locsData } = useSuspenseQuery<{
    inventoryLocations: { data: Array<{ id: string; name: string }> }
  }>(GET_INVENTORY_LOCATIONS)
  const { data: supData } = useSuspenseQuery<{
    suppliers: { data: Array<{ id: string; name: string }> }
  }>(GET_SUPPLIERS)
  const { data: productsData } = useSuspenseQuery<{
    products: { data: Product[] }
  }>(GET_PRODUCTS, { variables: { filters: { page: 1, limit: 50 } } })

  const locations = locsData?.inventoryLocations?.data ?? []
  const suppliers = supData?.suppliers?.data ?? []
  const products = productsData?.products?.data ?? []

  const [supplierId, setSupplierId] = useState<string>("none")
  const [destinationId, setDestinationId] = useState<string>(
    locations[0]?.id ?? "",
  )
  const [paymentTerms, setPaymentTerms] = useState<string>("NONE")
  const [currency, setCurrency] = useState<string>("USD")
  const [reference, setReference] = useState("")
  const [tracking, setTracking] = useState("")
  const [carrier, setCarrier] = useState("")
  const [expectedAt, setExpectedAt] = useState("")
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [shippingCents, setShippingCents] = useState("")
  const [search, setSearch] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      displayName(p.name, locale).toLowerCase().includes(q),
    )
  }, [products, search, locale])

  function addLine(item: {
    product_id?: string | null
    variation_option_id?: string | null
    label: string
    suggested_cost?: number
  }) {
    const key = `${item.product_id ?? ""}:${item.variation_option_id ?? ""}`
    if (lines.find((l) => l.key === key)) {
      sileo.warning({ title: t("alreadyAdded") })
      return
    }
    setLines((s) => [
      ...s,
      {
        ...item,
        key,
        supplier_sku: "",
        quantity: 1,
        unit_cost_cents: item.suggested_cost ?? 0,
        tax_percent_bps: null,
      },
    ])
  }

  function patchLine(key: string, patch: Partial<LineDraft>) {
    setLines((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag || tags.includes(tag)) return
    setTags((s) => [...s, tag])
    setTagInput("")
  }

  const subtotalCents = lines.reduce(
    (s, l) => s + l.quantity * l.unit_cost_cents,
    0,
  )
  const computedTaxCents = lines.reduce((s, l) => {
    const bps = l.tax_percent_bps ?? 0
    if (bps <= 0) return s
    return s + Math.round((l.quantity * l.unit_cost_cents * bps) / 10000)
  }, 0)
  const shipping = Number(shippingCents) || 0
  const totalCents = subtotalCents + computedTaxCents + shipping

  const [create, { loading }] = useMutation<CreatePurchaseOrderResult>(
    CREATE_PURCHASE_ORDER,
    {
      onCompleted: (resp) => {
        sileo.success({ title: t("created") })
        const id = resp?.createPurchaseOrder?.data?.id
        if (shopSlug && id) {
          router.push(
            `/store/${shopSlug}/products/inventory/purchase-orders/${id}`,
          )
        }
      },
      onError: (err) => sileo.error({ title: err.message }),
    },
  )

  function submit() {
    if (!destinationId) {
      sileo.error({ title: t("selectDestination") })
      return
    }
    if (lines.length === 0) {
      sileo.error({ title: t("addLine") })
      return
    }
    void create({
      variables: {
        input: {
          supplier_id: supplierId === "none" ? null : supplierId,
          destination_location_id: destinationId,
          reference: reference || null,
          tracking_number: tracking || null,
          shipping_carrier: carrier || null,
          note: note || null,
          expected_at: expectedAt ? new Date(expectedAt).toISOString() : null,
          payment_terms: paymentTerms,
          currency_code: currency || null,
          tags,
          shipping_cents: shipping,
          lines: lines.map((l) => ({
            product_id: l.product_id ?? null,
            variation_option_id: l.variation_option_id ?? null,
            supplier_sku: l.supplier_sku || null,
            quantity: l.quantity,
            unit_cost_cents: l.unit_cost_cents,
            tax_percent_bps: l.tax_percent_bps,
          })),
        },
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {shopSlug && (
          <Link
            href={`/store/${shopSlug}/products/inventory/purchase-orders`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {tPo("crumb")}
          </Link>
        )}
      </div>
      <h1 className="font-heading text-2xl font-semibold">{tPo("create")}</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Supplier + Destination */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <h3 className="font-medium">{t("supplierAndDestination")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("supplier")}</Label>
                  <Select
                    value={supplierId}
                    onValueChange={(v) => setSupplierId(v ?? "none")}
                  >
                    <SelectTrigger>
                      {/* A render function, not `items`: without one Base UI
                          prints the raw value ("none", a supplier id). */}
                      <SelectValue>
                        {(v: string | null) =>
                          !v
                            ? t("selectSupplier")
                            : v === "none"
                              ? t("noSupplier")
                              : (suppliers.find((s) => s.id === v)?.name ?? v)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noSupplier")}</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {shopSlug && (
                    <Link
                      href={`/store/${shopSlug}/products/inventory/suppliers`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {t("manageSuppliers")}
                    </Link>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("destination")}</Label>
                  <Select
                    value={destinationId}
                    onValueChange={(v) => setDestinationId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          locations.find((l) => l.id === v)?.name ?? v
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment terms */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <h3 className="font-medium">{t("purchasingInfo")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("paymentTerms")}</Label>
                  <Select
                    value={paymentTerms}
                    onValueChange={(v) => setPaymentTerms(v ?? "NONE")}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          tPo(`paymentTerms.${v ?? "NONE"}`)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {tPo(`paymentTerms.${term}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("supplierCurrency")}</Label>
                  <Select
                    value={currency}
                    onValueChange={(v) => setCurrency(v ?? "USD")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment details */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <h3 className="font-medium">{t("shipmentDetails")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("estimatedArrival")}</Label>
                  <Input
                    type="date"
                    value={expectedAt}
                    onChange={(e) => setExpectedAt(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("trackingNumber")}</Label>
                  <Input
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("shippingCarrier")}</Label>
                  <Input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder={t("carrierPlaceholder")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t("products")}</h3>
                <span className="text-xs text-muted-foreground">
                  {t("lineCount", { count: lines.length })}
                </span>
              </div>
              {lines.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("emptyLines")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-start">
                          {t("col.product")}
                        </th>
                        <th className="px-2 py-1 text-start">
                          {t("col.supplierSku")}
                        </th>
                        <th className="px-2 py-1 text-end">{t("col.qty")}</th>
                        <th className="px-2 py-1 text-end">
                          {t("col.unitCost")}
                        </th>
                        <th className="px-2 py-1 text-end">
                          {t("col.taxPercent")}
                        </th>
                        <th className="px-2 py-1 text-end">{t("col.total")}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const lineSubtotal = l.quantity * l.unit_cost_cents
                        const lineTax = l.tax_percent_bps
                          ? Math.round(
                              (lineSubtotal * l.tax_percent_bps) / 10000,
                            )
                          : 0
                        return (
                          <tr key={l.key} className="border-t border-border/60">
                            <td className="px-2 py-2">{l.label}</td>
                            <td className="px-2 py-2">
                              <Input
                                value={l.supplier_sku}
                                onChange={(e) =>
                                  patchLine(l.key, {
                                    supplier_sku: e.target.value,
                                  })
                                }
                                placeholder={t("optional")}
                                className="h-8 w-28 font-mono text-xs"
                              />
                            </td>
                            <td className="px-2 py-2 text-end">
                              <Input
                                type="number"
                                min={1}
                                value={l.quantity}
                                onChange={(e) =>
                                  patchLine(l.key, {
                                    quantity: Math.max(
                                      1,
                                      Number(e.target.value) || 1,
                                    ),
                                  })
                                }
                                className="ms-auto h-8 w-20 text-end tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2 text-end">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={(l.unit_cost_cents / 100).toFixed(2)}
                                onChange={(e) =>
                                  patchLine(l.key, {
                                    unit_cost_cents: Math.max(
                                      0,
                                      Math.round(
                                        (Number(e.target.value) || 0) * 100,
                                      ),
                                    ),
                                  })
                                }
                                className="ms-auto h-8 w-24 text-end tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2 text-end">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={
                                  l.tax_percent_bps != null
                                    ? l.tax_percent_bps / 100
                                    : ""
                                }
                                onChange={(e) => {
                                  const v = e.target.value
                                  patchLine(l.key, {
                                    tax_percent_bps:
                                      v === ""
                                        ? null
                                        : Math.max(
                                            0,
                                            Math.min(
                                              10000,
                                              Math.round(
                                                (Number(v) || 0) * 100,
                                              ),
                                            ),
                                          ),
                                  })
                                }}
                                placeholder="—"
                                className="ms-auto h-8 w-16 text-end tabular-nums"
                              />
                            </td>
                            <td className="px-2 py-2 text-end tabular-nums">
                              {fmtMoney(lineSubtotal + lineTax, currency)}
                            </td>
                            <td className="px-2 py-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                aria-label={tCommon("delete")}
                                onClick={() =>
                                  setLines((s) =>
                                    s.filter((x) => x.key !== l.key),
                                  )
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost summary */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <h3 className="font-medium">{t("costSummary")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("shippingWithCurrency", { currency })}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={shippingCents ? (Number(shippingCents) / 100).toFixed(2) : ""}
                    onChange={(e) =>
                      setShippingCents(
                        String(
                          Math.max(
                            0,
                            Math.round((Number(e.target.value) || 0) * 100),
                          ),
                        ),
                      )
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-muted/30 px-3 py-2 text-sm">
                <Row
                  label={t("subtotal")}
                  value={fmtMoney(subtotalCents, currency)}
                />
                <Row
                  label={t("taxFromLines")}
                  value={fmtMoney(computedTaxCents, currency)}
                />
                <Row
                  label={t("shipping")}
                  value={fmtMoney(shipping, currency)}
                />
                <div className="my-1 border-t border-border/60" />
                <Row
                  label={t("total")}
                  value={fmtMoney(totalCents, currency)}
                  bold
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional details */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <h3 className="font-medium">{t("additionalDetails")}</h3>
              <div className="flex flex-col gap-1.5">
                <Label>{t("referenceNumber")}</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t("referencePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("noteToSupplier")}</Label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("tags")}</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          setTags((s) => s.filter((x) => x !== tag))
                        }
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    onBlur={addTag}
                    placeholder={t("addTag")}
                    className="h-7 w-32 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={submit} disabled={loading}>
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              {t("saveDraft")}
            </Button>
          </div>
        </div>

        {/* Product picker */}
        <div className="flex flex-col gap-2">
          <h3 className="px-1 text-sm font-medium">{t("addProducts")}</h3>
          <Card>
            <CardContent className="flex flex-col gap-2 py-3">
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={tInv("searchProducts")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 ps-8"
                />
              </div>
              <div className="flex max-h-[480px] flex-col gap-1 overflow-y-auto">
                {filteredProducts.length === 0 && (
                  <span className="px-2 py-4 text-center text-xs text-muted-foreground">
                    {t("noProducts")}
                  </span>
                )}
                {filteredProducts.map((p) => {
                  const isVar = p.product_type === "VARIABLE"
                  if (!isVar) {
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          addLine({
                            product_id: p.id,
                            variation_option_id: null,
                            label: displayName(p.name, locale),
                            suggested_cost: p.price_cents ?? 0,
                          })
                        }
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                      >
                        <span className="truncate">
                          {displayName(p.name, locale)}
                        </span>
                        <Plus className="size-3.5 text-muted-foreground" />
                      </button>
                    )
                  }
                  return (
                    <div key={p.id} className="flex flex-col">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        {displayName(p.name, locale)}
                      </div>
                      <div className="flex flex-col gap-0.5 ps-2">
                        {(p.variation_options ?? []).map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() =>
                              addLine({
                                variation_option_id: v.id,
                                label: `${displayName(p.name, locale)} · ${displayName(v.title, locale)}`,
                                suggested_cost: v.price_cents ?? 0,
                              })
                            }
                            className="flex items-center justify-between rounded-md px-2 py-1 text-start text-xs hover:bg-muted"
                          >
                            <span className="truncate">
                              {displayName(v.title, locale)}
                            </span>
                            <Plus className="size-3 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div
      className={
        "flex items-center justify-between " +
        (bold ? "font-semibold text-foreground" : "text-muted-foreground")
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function fmtMoney(cents: number, currency: string) {
  return formatMoneyCents(cents, currency)
}

/** A product/variant name in the dashboard's language, falling back to any. */
function displayName(name: LocalizedName, locale: string): string {
  if (!name) return "—"
  if (typeof name === "string") return name
  return name[locale] ?? name.en ?? name.ar ?? Object.values(name)[0] ?? "—"
}
