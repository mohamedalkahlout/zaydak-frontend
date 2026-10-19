"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  useApolloClient,
  useMutation,
  useSuspenseQuery,
} from "@apollo/client/react"
import {
  ArrowLeft,
  Send,
  PackageCheck,
  X,
  Loader2,
  Trash2,
  FileDown,
  MoreHorizontal,
} from "lucide-react"
import { sileo } from "sileo"
import { dashboardLocale } from "@/shared/i18n/dashboard-locale"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import {
  GET_PURCHASE_ORDER,
  GET_PURCHASE_ORDERS,
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_ITEMS,
  ORDER_PURCHASE_ORDER,
  RECEIVE_PURCHASE_ORDER,
  CLOSE_PURCHASE_ORDER,
  DELETE_PURCHASE_ORDER,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Badge } from "@repo/ui/components/badge"
import { Card, CardContent } from "@repo/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@/shared/lib/utils"

type POLine = {
  id: string
  product_id?: string | null
  variation_option_id?: string | null
  supplier_sku?: string | null
  quantity: number
  received_quantity: number
  rejected_quantity: number
  unit_cost_cents: number
  tax_percent_bps?: number | null
}
type PaymentTerms =
  | "NONE"
  | "CASH_ON_DELIVERY"
  | "PAYMENT_ON_RECEIPT"
  | "PAYMENT_IN_ADVANCE"
  | "NET_7"
  | "NET_15"
  | "NET_30"
  | "NET_45"
  | "NET_60"
type PO = {
  id: string
  supplier_id?: string | null
  destination_location_id: string
  status: "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CLOSED"
  reference?: string | null
  tracking_number?: string | null
  shipping_carrier?: string | null
  payment_terms: PaymentTerms
  currency_code?: string | null
  tags: string[]
  note?: string | null
  expected_at?: string | null
  subtotal_cents: number
  tax_cents: number
  shipping_cents: number
  total_cents: number
  ordered_at?: string | null
  received_at?: string | null
  closed_at?: string | null
  created_at: string
  supplier?: {
    id: string
    name: string
    contact_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
  lines: POLine[]
}

export function PurchaseOrderDetailPage({ poId }: { poId: string }) {
  const t = useTranslations("inventory.purchaseOrderDetail")
  const tPo = useTranslations("inventory.purchaseOrders")
  // Payment-term labels are shared with the create page; "no terms" reads as
  // a dash here rather than the picker's "No payment terms".
  const termLabel = (terms: PaymentTerms) =>
    terms === "NONE" ? "—" : tPo(`paymentTerms.${terms}`)
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const apollo = useApolloClient()

  const { data, refetch } = useSuspenseQuery<{
    purchaseOrder: { data: PO }
  }>(GET_PURCHASE_ORDER, { variables: { id: poId } })
  const { data: locsData } = useSuspenseQuery<{
    inventoryLocations: { data: Array<{ id: string; name: string }> }
  }>(GET_INVENTORY_LOCATIONS)

  const po = data?.purchaseOrder?.data
  const locations = locsData?.inventoryLocations?.data ?? []
  const locName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id.slice(0, 6)

  const [draft, setDraft] = useState<
    Record<string, { accepted: number; rejected: number }>
  >({})

  const [orderMutation, { loading: ordering }] = useMutation(
    ORDER_PURCHASE_ORDER,
    {
      onCompleted: () => {
        sileo.success({ title: t("ordered") })
        void refetch()
        void apollo.refetchQueries({
          include: [GET_PURCHASE_ORDERS, GET_INVENTORY_ITEMS],
        })
      },
      onError: (err) => sileo.error({ title: err.message }),
    },
  )
  const [receiveMutation, { loading: receiving }] = useMutation(
    RECEIVE_PURCHASE_ORDER,
    {
      onCompleted: () => {
        sileo.success({ title: t("receiveSaved") })
        setDraft({})
        void refetch()
        void apollo.refetchQueries({
          include: [GET_PURCHASE_ORDERS, GET_INVENTORY_ITEMS],
        })
      },
      onError: (err) => sileo.error({ title: err.message }),
    },
  )
  const [closeMutation, { loading: closing }] = useMutation(
    CLOSE_PURCHASE_ORDER,
    {
      onCompleted: () => {
        sileo.success({ title: t("closed") })
        void refetch()
        void apollo.refetchQueries({
          include: [GET_PURCHASE_ORDERS, GET_INVENTORY_ITEMS],
        })
      },
      onError: (err) => sileo.error({ title: err.message }),
    },
  )
  const [deleteMutation, { loading: deleting }] = useMutation(
    DELETE_PURCHASE_ORDER,
    {
      onCompleted: () => {
        sileo.success({ title: t("draftDeleted") })
        void apollo.refetchQueries({ include: [GET_PURCHASE_ORDERS] })
        if (shopSlug)
          window.location.assign(
            `/store/${shopSlug}/products/inventory/purchase-orders`,
          )
      },
      onError: (err) => sileo.error({ title: err.message }),
    },
  )

  if (!po) return null

  const canOrder = po.status === "DRAFT"
  const canReceive =
    po.status === "ORDERED" ||
    po.status === "PARTIAL" ||
    po.status === "RECEIVED"
  const canClose = po.status !== "DRAFT" && po.status !== "CLOSED"
  const canDelete = po.status === "DRAFT"
  const currency = po.currency_code ?? "USD"

  function applyReceive() {
    const lines = po.lines
      .map((ln) => {
        const d = draft[ln.id]
        if (!d) return null
        const acc = d.accepted ?? 0
        const rej = d.rejected ?? 0
        if (acc === 0 && rej === 0) return null
        return {
          line_id: ln.id,
          accepted_quantity: acc,
          rejected_quantity: rej,
        }
      })
      .filter(Boolean) as Array<{
      line_id: string
      accepted_quantity: number
      rejected_quantity: number
    }>

    if (lines.length === 0) {
      sileo.warning({ title: t("enterQty") })
      return
    }
    void receiveMutation({
      variables: { input: { purchase_order_id: po.id, lines } },
    })
  }

  function downloadPdf() {
    // Browser-side print to PDF — opens a print-friendly window. No
    // server-side renderer needed; users get the platform's native
    // "Save as PDF" experience via the print dialog.
    window.print()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {po.reference ?? tPo("poNumber", { id: po.id.slice(0, 8) })}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {po.supplier?.name && <span>{po.supplier.name}</span>}
            {po.supplier?.name && <span>·</span>}
            <span>{locName(po.destination_location_id)}</span>
            {po.payment_terms !== "NONE" && (
              <>
                <span>·</span>
                <span>{termLabel(po.payment_terms)}</span>
              </>
            )}
          </div>
          {po.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {po.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <StatusPill status={po.status} />
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("col.product")}
                  </th>
                  <th className="px-3 py-2 text-start font-medium">
                    {t("col.supplierSku")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("col.qty")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("col.accepted")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("col.rejected")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("col.unitCost")}
                  </th>
                  {canReceive && (
                    <>
                      <th className="px-3 py-2 text-end font-medium">
                        {t("col.acceptNow")}
                      </th>
                      <th className="px-3 py-2 text-end font-medium">
                        {t("col.rejectNow")}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {po.lines.map((ln) => {
                  const remaining =
                    ln.quantity - ln.received_quantity - ln.rejected_quantity
                  return (
                    <tr key={ln.id} className="border-t border-border/60">
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs">
                          {ln.variation_option_id ?? ln.product_id}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {ln.supplier_sku ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {ln.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {ln.received_quantity}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {ln.rejected_quantity}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {fmtMoney(ln.unit_cost_cents, currency)}
                      </td>
                      {canReceive && (
                        <>
                          <td className="px-3 py-2.5 text-end">
                            <Input
                              type="number"
                              defaultValue={
                                po.status === "ORDERED" ||
                                po.status === "PARTIAL"
                                  ? remaining
                                  : 0
                              }
                              onChange={(e) =>
                                setDraft((s) => ({
                                  ...s,
                                  [ln.id]: {
                                    accepted: Number(e.target.value) || 0,
                                    rejected: s[ln.id]?.rejected ?? 0,
                                  },
                                }))
                              }
                              className="ml-auto h-8 w-20 text-end tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-end">
                            <Input
                              type="number"
                              defaultValue={0}
                              onChange={(e) =>
                                setDraft((s) => ({
                                  ...s,
                                  [ln.id]: {
                                    accepted: s[ln.id]?.accepted ?? 0,
                                    rejected: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="ml-auto h-8 w-20 text-end tabular-nums"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">
            <Field label={t("field.reference")}>{po.reference ?? "—"}</Field>
            <Field label={t("field.paymentTerms")}>
              {termLabel(po.payment_terms)}
            </Field>
            <Field label={t("field.tracking")}>
              {po.tracking_number ?? "—"}
            </Field>
            <Field label={t("field.shippingCarrier")}>
              {po.shipping_carrier ?? "—"}
            </Field>
            <Field label={t("field.currency")}>
              {po.currency_code ?? "—"}
            </Field>
            <Field label={t("field.created")}>{fmt(po.created_at)}</Field>
            {po.expected_at && (
              <Field label={t("field.expected")}>
                {formatDate(po.expected_at)}
              </Field>
            )}
            {po.ordered_at && (
              <Field label={t("field.ordered")}>{fmt(po.ordered_at)}</Field>
            )}
            {po.received_at && (
              <Field label={t("field.received")}>{fmt(po.received_at)}</Field>
            )}
            {po.closed_at && (
              <Field label={t("field.closed")}>{fmt(po.closed_at)}</Field>
            )}
            {po.note && (
              <Field label={t("field.note")} className="sm:col-span-2">
                {po.note}
              </Field>
            )}
            {po.supplier && (
              <Field label={t("field.supplier")} className="sm:col-span-2">
                <div>
                  <div className="font-medium text-foreground">
                    {po.supplier.name}
                  </div>
                  <div className="text-xs">
                    {[
                      po.supplier.contact_name,
                      po.supplier.email,
                      po.supplier.phone,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 py-3 text-sm">
            <h3 className="font-medium">{t("summary")}</h3>
            <Row
              label={t("subtotal")}
              value={fmtMoney(po.subtotal_cents, currency)}
            />
            <Row label={t("tax")} value={fmtMoney(po.tax_cents, currency)} />
            <Row
              label={t("shipping")}
              value={fmtMoney(po.shipping_cents, currency)}
            />
            <div className="my-1 border-t border-border/60" />
            <Row
              label={t("total")}
              value={fmtMoney(po.total_cents, currency)}
              bold
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <Button {...triggerProps} variant="outline" size="sm">
                <MoreHorizontal className="size-4" />
                {t("moreActions")}
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={downloadPdf}>
              <FileDown className="size-3.5" />
              {t("exportPdf")}
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem
                onClick={() => {
                  if (window.confirm(t("confirmDelete"))) {
                    void deleteMutation({ variables: { id: po.id } })
                  }
                }}
                disabled={deleting}
                className="text-destructive"
              >
                <Trash2 className="size-3.5" />
                {t("deleteDraft")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {canClose && (
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm(t("confirmClose"))) {
                void closeMutation({ variables: { id: po.id } })
              }
            }}
            disabled={closing}
          >
            <X className="size-3.5" /> {t("close")}
          </Button>
        )}
        {canOrder && (
          <Button
            onClick={() => void orderMutation({ variables: { id: po.id } })}
            disabled={ordering}
          >
            {ordering ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {t("markOrdered")}
          </Button>
        )}
        {canReceive && (
          <Button onClick={applyReceive} disabled={receiving}>
            {receiving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <PackageCheck className="size-3.5" />
            )}
            {t("saveReceive")}
          </Button>
        )}
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
        "rounded-full px-2.5 py-1 text-xs font-medium",
        tone[status],
      )}
    >
      {tPo(`status.${status}`)}
    </span>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleString(dashboardLocale())
}

function fmtMoney(cents: number, currency: string) {
  return formatMoneyCents(cents, currency)
}
