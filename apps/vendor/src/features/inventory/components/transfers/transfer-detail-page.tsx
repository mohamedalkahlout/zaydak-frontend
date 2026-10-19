"use client"

import { useEffect, useState } from "react"
import { useForm, type Path } from "react-hook-form"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  useApolloClient,
  useMutation,
  useSuspenseQuery,
} from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  ArrowLeftRight,
  Truck,
  CheckCheck,
  ClipboardCheck,
  Loader2,
  Pencil,
  Copy,
  Trash2,
  X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react"
import { sileo } from "sileo"
import {
  GET_INVENTORY_TRANSFER,
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_TRANSFERS,
  GET_INVENTORY_ITEMS,
  GET_INVENTORY_TRANSFER_TIMELINE,
  MARK_TRANSFER_READY_TO_SHIP,
  MARK_TRANSFER_TRANSFERRED,
  MANAGE_RECEIVED_ITEMS,
  SEND_INVENTORY_TRANSFER,
  RECEIVE_INVENTORY_TRANSFER,
  CANCEL_INVENTORY_TRANSFER,
  DUPLICATE_INVENTORY_TRANSFER,
  DELETE_INVENTORY_TRANSFER,
  UPDATE_INVENTORY_TRANSFER,
} from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import {
  LineItemCell,
  StatusBadge,
  formatTransferNumber,
  toUtcDayIso,
  type TransferStatus,
} from "./transfer-helpers"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { LocationPill } from "./location-flow"
import { MetadataChips, type TransferMetaPatch } from "./metadata-chips"
import { DetailsCard } from "./details-card"
import { Timeline } from "./transfer-timeline"
import {
  ReceiveItemsDialog,
  type ReceivePayloadLine,
} from "./receive-items-dialog"

type TransferLine = {
  id: string
  product_id?: string | null
  variation_option_id?: string | null
  quantity: number
  received_quantity: number
  rejected_quantity: number
  product_name?: Record<string, string> | string | null
  variant_title?: Record<string, string> | string | null
  image?: unknown
  sku?: string | null
  available_at_source?: number | null
  available_at_destination?: number | null
}
type Transfer = {
  id: string
  number?: number | null
  source_location_id: string | null
  destination_location_id: string | null
  status: TransferStatus
  reference?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  shipping_carrier?: string | null
  shipment_cost_cents?: number | null
  barcode?: string | null
  note?: string | null
  tags?: string[] | null
  expected_arrival?: string | null
  created_at: string
  lines: TransferLine[]
}
type DetailResp = { inventoryTransfer: { success: boolean; data: Transfer } }
type LocationsResp = {
  inventoryLocations: { data: Array<{ id: string; name: string }> }
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n))
const remainingOf = (ln: TransferLine) =>
  ln.quantity - ln.received_quantity - ln.rejected_quantity

// ── Inline-edit form (react-hook-form) ───────────────────────────────────────
// All inline-editable fields live in one form. `defaultValues` is the server
// snapshot, so rhf's value-based `isDirty` drives the save bar and `reset()`
// (Discard / a server refetch) restores the inputs — no hand-rolled diffing.
type EditValues = {
  reference: string | null
  note: string | null
  tags: string[]
  tracking_number: string | null
  tracking_url: string | null
  shipping_carrier: string | null
  expected_arrival: string | null
  barcode: string | null
  shipment_cost_cents: number | null
  qty: Record<string, number> // lineId → quantity (DRAFT-editable)
}
const EMPTY_EDIT_VALUES: EditValues = {
  reference: null,
  note: null,
  tags: [],
  tracking_number: null,
  tracking_url: null,
  shipping_carrier: null,
  expected_arrival: null,
  barcode: null,
  shipment_cost_cents: null,
  qty: {},
}
function buildDefaults(tr: Transfer): EditValues {
  return {
    reference: tr.reference ?? null,
    note: tr.note ?? null,
    tags: [...(tr.tags ?? [])].sort(), // sorted → order-stable dirty (Shopify sorts tags)
    tracking_number: tr.tracking_number ?? null,
    tracking_url: tr.tracking_url ?? null,
    shipping_carrier: tr.shipping_carrier ?? null,
    expected_arrival: toUtcDayIso(tr.expected_arrival),
    barcode: tr.barcode ?? null,
    shipment_cost_cents: tr.shipment_cost_cents ?? null,
    qty: Object.fromEntries(tr.lines.map((ln) => [ln.id, ln.quantity])),
  }
}
const sameArr = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

export function TransferDetailPage({ transferId }: { transferId: string }) {
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const router = useRouter()
  const apollo = useApolloClient()
  const locale = useLocale()
  const t = useTranslations("transfers.detail")
  const tRoot = useTranslations("transfers")
  const tToast = useTranslations("transfers.toast")
  const tConfirm = useTranslations("transfers.confirm")
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const { data, refetch } = useSuspenseQuery<DetailResp>(GET_INVENTORY_TRANSFER, {
    variables: { id: transferId },
  })
  const { data: locsData } = useSuspenseQuery<LocationsResp>(
    GET_INVENTORY_LOCATIONS,
  )
  const transfer = data?.inventoryTransfer?.data
  const locations = locsData?.inventoryLocations?.data ?? []
  const locName = (id: string | null | undefined) =>
    id
      ? (locations.find((l) => l.id === id)?.name ?? id.slice(0, 6))
      : tRoot("unspecified")

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const [manageDraft, setManageDraft] = useState<
    Record<string, { received: number; rejected: number }>
  >({})
  // Staged inline edits (reference/note/tags/metadata + per-line quantity) via
  // react-hook-form. Nothing is written until the global save bar's Save is
  // clicked — no auto-save. See the "contextual save bar" rule in AGENTS.md.
  const form = useForm<EditValues>({
    defaultValues: transfer ? buildDefaults(transfer) : EMPTY_EDIT_VALUES,
  })
  const { watch, setValue, getValues, reset, handleSubmit, formState } = form
  const fv = watch()
  const dirty = formState.isDirty

  const refreshAll = () => {
    void refetch()
    void apollo.refetchQueries({
      include: [
        GET_INVENTORY_TRANSFERS,
        GET_INVENTORY_ITEMS,
        GET_INVENTORY_TRANSFER_TIMELINE,
      ],
    })
  }
  const onErr = (err: { message: string }) => sileo.error({ title: err.message })

  const [markReady] = useMutation(MARK_TRANSFER_READY_TO_SHIP, {
    onCompleted: () => {
      sileo.success({ title: tToast("ready") })
      refreshAll()
    },
    onError: onErr,
  })
  const [send, { loading: sending }] = useMutation(SEND_INVENTORY_TRANSFER, {
    onCompleted: () => { sileo.success({ title: tToast("sent") }); refreshAll() },
    onError: onErr,
  })
  const [markTransferred, { loading: transferring }] = useMutation(
    MARK_TRANSFER_TRANSFERRED,
    { onCompleted: () => { sileo.success({ title: tToast("transferred") }); refreshAll() }, onError: onErr },
  )
  const [manageReceived, { loading: managingSave }] = useMutation(
    MANAGE_RECEIVED_ITEMS,
    {
      onCompleted: () => {
        sileo.success({ title: tToast("receivedUpdated") })
        setManaging(false)
        setManageDraft({})
        refreshAll()
      },
      onError: onErr,
    },
  )
  const [receive, { loading: receiving }] = useMutation(
    RECEIVE_INVENTORY_TRANSFER,
    {
      onCompleted: () => {
        sileo.success({ title: tToast("receivedDone") })
        setReceiveOpen(false)
        refreshAll()
      },
      onError: onErr,
    },
  )
  const [cancel, { loading: cancelling }] = useMutation(
    CANCEL_INVENTORY_TRANSFER,
    { onCompleted: () => { sileo.success({ title: tToast("cancelled") }); setConfirmCancel(false); refreshAll() }, onError: onErr },
  )
  const [duplicate, { loading: duplicating }] = useMutation<{
    duplicateInventoryTransfer: { data?: { id: string } | null }
  }>(DUPLICATE_INVENTORY_TRANSFER, {
    onCompleted: (resp) => {
      sileo.success({ title: tToast("duplicated") })
      const id = resp?.duplicateInventoryTransfer?.data?.id
      if (shopSlug && id)
        router.push(`/store/${shopSlug}/products/inventory/transfers/${id}`)
    },
    onError: onErr,
  })
  const [remove, { loading: removing }] = useMutation(DELETE_INVENTORY_TRANSFER, {
    onCompleted: () => {
      sileo.success({ title: tToast("deleted") })
      void apollo.refetchQueries({ include: [GET_INVENTORY_TRANSFERS] })
      if (shopSlug)
        router.push(`/store/${shopSlug}/products/inventory/transfers`)
    },
    onError: onErr,
  })
  const [update, { loading: savingDetails }] = useMutation(
    UPDATE_INVENTORY_TRANSFER,
    {
      onCompleted: () => {
        // The form resets to the new server values via the serverSig effect
        // once the refetch lands, which clears dirty + hides the bar.
        sileo.success({ title: tToast("detailsSaved") })
        refreshAll()
      },
      onError: (err) => {
        sileo.error({ title: err.message })
        setBarError(err.message)
      },
    },
  )

  // Re-sync the form to the server whenever the server's *editable* fields
  // change (after a save+refetch, or any external update) — clearing dirty.
  // Keyed on a signature of just those fields, so unrelated refetches (status
  // changes, timeline, etc.) don't wipe in-progress edits.
  const serverSig = transfer
    ? JSON.stringify([
        transfer.reference ?? null,
        transfer.note ?? null,
        [...(transfer.tags ?? [])].sort(),
        transfer.tracking_number ?? null,
        transfer.tracking_url ?? null,
        transfer.shipping_carrier ?? null,
        toUtcDayIso(transfer.expected_arrival),
        transfer.barcode ?? null,
        transfer.shipment_cost_cents ?? null,
        transfer.lines.map((l) => [l.id, l.quantity]),
      ])
    : ""
  useEffect(() => {
    if (transfer) reset(buildDefaults(transfer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSig])

  // Save = one updateInventoryTransfer with only the changed fields. handleSubmit
  // hands us the *live* form values, which we diff against the server snapshot —
  // sending only what changed (so the backend's metadata-only-once-processed
  // guard isn't tripped by unchanged fields).
  const onSave = handleSubmit((values) => {
    if (!transfer) return
    setBarError(null)
    const def = buildDefaults(transfer)
    const input: Record<string, unknown> = { id: transfer.id }
    const scalarKeys = [
      "reference",
      "note",
      "tracking_number",
      "tracking_url",
      "shipping_carrier",
      "expected_arrival",
      "barcode",
      "shipment_cost_cents",
    ] as const
    for (const k of scalarKeys) if (values[k] !== def[k]) input[k] = values[k]
    if (!sameArr(values.tags, def.tags)) input.tags = values.tags
    if (
      transfer.lines.some(
        (ln) => (values.qty[ln.id] ?? ln.quantity) !== ln.quantity,
      )
    ) {
      input.lines = transfer.lines.map((ln) => ({
        product_id: ln.product_id ?? null,
        variation_option_id: ln.variation_option_id ?? null,
        quantity: values.qty[ln.id] ?? ln.quantity,
      }))
    }
    void update({ variables: { input } })
  })
  const onDiscard = () => {
    reset()
    setBarError(null)
  }

  // Register / refresh the global save bar while the form is dirty; tear it down
  // on unmount.
  useEffect(() => {
    if (!transfer || !dirty) {
      hideBar()
      return
    }
    showBar({
      label: tRoot("unsavedChanges"),
      saving: savingDetails,
      onSave,
      onDiscard,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfer, dirty, savingDetails])
  useEffect(() => () => hideBar(), [hideBar])

  if (!transfer) return null

  const isDraft = transfer.status === "DRAFT"
  const canMarkReady = transfer.status === "DRAFT"
  const canSend = transfer.status === "DRAFT" || transfer.status === "READY_TO_SHIP"
  const canReceive = transfer.status === "SENT" || transfer.status === "PARTIAL"
  const canCancel =
    transfer.status === "DRAFT" ||
    transfer.status === "READY_TO_SHIP" ||
    transfer.status === "SENT"
  const isDone = transfer.status === "RECEIVED" || transfer.status === "CANCELLED"
  const canMarkTransferred = !isDone
  const canManageReceived = transfer.status === "RECEIVED"
  const totalUnits = transfer.lines.reduce((s, l) => s + l.quantity, 0)

  // Inline editors stage every change into the form (shouldDirty drives the bar
  // and is value-based, so reverting a field collapses it). The watched `fv`
  // exposes the effective (server-overlaid-with-staged) values for display.
  const setField = (name: keyof EditValues, value: unknown) =>
    setValue(name as Path<EditValues>, value as never, { shouldDirty: true })
  const patchMeta = (patch: TransferMetaPatch) => {
    for (const [k, v] of Object.entries(patch)) setField(k as keyof EditValues, v)
  }

  // Quick receive (Accept all / Reject all) from the split action dropdown.
  const quickReceive = (mode: "accept" | "reject") => {
    const lines = transfer.lines
      .map((ln) => {
        const rem = remainingOf(ln)
        return {
          line_id: ln.id,
          received_quantity: mode === "accept" ? rem : 0,
          rejected_quantity: mode === "reject" ? rem : 0,
        }
      })
      .filter((l) => l.received_quantity > 0 || l.rejected_quantity > 0)
    if (lines.length === 0) {
      sileo.warning({ title: t("nothingToReceive") })
      return
    }
    void receive({ variables: { input: { transfer_id: transfer.id, lines } } })
  }
  const doReceive = (lines: ReceivePayloadLine[]) => {
    if (lines.length === 0) {
      sileo.warning({ title: t("nothingToReceive") })
      return
    }
    void receive({ variables: { input: { transfer_id: transfer.id, lines } } })
  }

  // Manage-mode (correct a RECEIVED transfer): absolute totals.
  const mngRej = (ln: TransferLine) =>
    clamp(manageDraft[ln.id]?.rejected ?? ln.rejected_quantity, 0, ln.quantity)
  const mngRec = (ln: TransferLine) =>
    clamp(
      manageDraft[ln.id]?.received ?? ln.received_quantity,
      0,
      ln.quantity - mngRej(ln),
    )
  const applyManage = () => {
    const lines = transfer.lines.map((ln) => ({
      line_id: ln.id,
      received_quantity: mngRec(ln),
      rejected_quantity: mngRej(ln),
    }))
    void manageReceived({
      variables: { input: { transfer_id: transfer.id, lines } },
    })
  }

  // Primary split-button action by status.
  const primary = (() => {
    if (canReceive)
      return {
        label: t("receiveItems"),
        onClick: () => setReceiveOpen(true),
        loading: false,
        secondary: [
          { label: tRoot("receiveDialog.acceptAll"), onClick: () => quickReceive("accept") },
          { label: tRoot("receiveDialog.rejectAll"), onClick: () => quickReceive("reject") },
        ],
      }
    if (canSend)
      return {
        label: t("markInTransit"),
        onClick: () => void send({ variables: { id: transfer.id } }),
        loading: sending,
        secondary: canMarkReady
          ? [
              {
                label: t("markReadyToShip"),
                onClick: () => void markReady({ variables: { id: transfer.id } }),
              },
            ]
          : [],
      }
    return null
  })()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
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
              {formatTransferNumber(transfer.number, transfer.id)}
            </h1>
            <StatusBadge status={transfer.status} size="md" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tRoot("createdOn", {
              date: new Date(transfer.created_at).toLocaleDateString(locale, {
                month: "long",
                day: "numeric",
                year: "numeric",
              }),
            })}
            {" • "}
            {tRoot("unitsLabel", { count: totalUnits })}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(p) => (
              <Button {...p} variant="outline">
                {t("moreActions")}
                <ChevronDown className="size-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-48">
            {isDraft && shopSlug && (
              <DropdownMenuItem
                render={
                  <Link
                    href={`/store/${shopSlug}/products/inventory/transfers/${transfer.id}/edit`}
                  />
                }
              >
                <Pencil className="size-3.5" />
                {t("edit")}
              </DropdownMenuItem>
            )}
            {canMarkTransferred && (
              <DropdownMenuItem
                onClick={() => void markTransferred({ variables: { id: transfer.id } })}
                disabled={transferring}
              >
                <CheckCheck className="size-3.5" />
                {t("markTransferred")}
              </DropdownMenuItem>
            )}
            {canManageReceived && (
              <DropdownMenuItem
                onClick={() => {
                  setManageDraft({})
                  setManaging(true)
                }}
              >
                <ClipboardCheck className="size-3.5" />
                {t("manageReceived")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => void duplicate({ variables: { id: transfer.id } })}
              disabled={duplicating}
            >
              <Copy className="size-3.5" />
              {t("duplicate")}
            </DropdownMenuItem>
            {canCancel && (
              <DropdownMenuItem
                onClick={() => setConfirmCancel(true)}
                variant="destructive"
              >
                <X className="size-3.5" />
                {t("cancelTransfer")}
              </DropdownMenuItem>
            )}
            {isDraft && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                  {t("delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Product card: flow rail + table + chips */}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <FlowRail
            origin={locName(transfer.source_location_id)}
            destination={locName(transfer.destination_location_id)}
          />
          {primary && (
            <div className="inline-flex shrink-0">
              <Button
                onClick={primary.onClick}
                disabled={primary.loading || receiving}
                className={primary.secondary.length ? "rounded-e-none" : ""}
              >
                {(primary.loading || (receiving && canReceive)) && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {primary.label}
              </Button>
              {primary.secondary.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={(p) => (
                      <Button
                        {...p}
                        size="icon"
                        className="rounded-s-none border-s border-background/20"
                        aria-label={t("moreActions")}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    )}
                  />
                  <DropdownMenuContent align="end">
                    {primary.secondary.map((s) => (
                      <DropdownMenuItem key={s.label} onClick={s.onClick}>
                        {s.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        <ProductsTable
          transfer={transfer}
          quantities={fv.qty}
          locName={locName}
          managing={managing}
          mngRec={mngRec}
          mngRej={mngRej}
          setManageRec={(ln, v) =>
            setManageDraft((s) => ({
              ...s,
              [ln.id]: {
                received: clamp(v, 0, ln.quantity - mngRej(ln)),
                rejected: mngRej(ln),
              },
            }))
          }
          setManageRej={(ln, v) =>
            setManageDraft((s) => ({
              ...s,
              [ln.id]: { received: mngRec(ln), rejected: clamp(v, 0, ln.quantity) },
            }))
          }
          onCommitQty={(lineId, qty) =>
            setValue(
              "qty",
              { ...getValues("qty"), [lineId]: Math.max(1, qty) },
              { shouldDirty: true },
            )
          }
          locale={locale}
        />

        {transfer.status !== "CANCELLED" && (
          <div className="border-t border-border p-3">
            <MetadataChips
              trackingNumber={fv.tracking_number}
              trackingUrl={fv.tracking_url}
              carrier={fv.shipping_carrier}
              expectedArrival={fv.expected_arrival}
              barcode={fv.barcode}
              shipmentCostCents={fv.shipment_cost_cents}
              onSave={patchMeta}
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* Manage-received save bar */}
      {managing && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setManaging(false)
              setManageDraft({})
            }}
          >
            {t("cancelManage")}
          </Button>
          <Button onClick={applyManage} disabled={managingSave}>
            {managingSave ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ClipboardCheck className="size-3.5" />
            )}
            {t("saveReceived")}
          </Button>
        </div>
      )}

      {/* Details card */}
      <DetailsCard
        date={new Date(transfer.created_at)}
        reference={fv.reference ?? ""}
        onChangeReference={(v) => setField("reference", v.trim() || null)}
        note={fv.note ?? ""}
        onChangeNote={(v) => setField("note", v.trim() || null)}
        tags={fv.tags ?? []}
        onChangeTags={(v) => setField("tags", [...v].sort())}
        locale={locale}
        readOnly={transfer.status === "CANCELLED"}
      />

      {/* Timeline */}
      <Timeline transferId={transfer.id} locale={locale} />

      {/* Dialogs */}
      <ReceiveItemsDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        destinationLabel={locName(transfer.destination_location_id)}
        inTransitCount={transfer.lines.reduce((s, l) => s + remainingOf(l), 0)}
        lines={transfer.lines}
        locale={locale}
        receiving={receiving}
        onReceive={doReceive}
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={tConfirm("cancelTitle")}
        description={tConfirm("cancelDescription")}
        confirmLabel={tConfirm("confirmCancel")}
        cancelLabel={tConfirm("keep")}
        destructive
        loading={cancelling}
        onConfirm={() => void cancel({ variables: { id: transfer.id } })}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={tConfirm("deleteTitle")}
        description={tConfirm("deleteDescription")}
        confirmLabel={tConfirm("confirmDelete")}
        cancelLabel={tConfirm("keep")}
        destructive
        loading={removing}
        onConfirm={() => void remove({ variables: { id: transfer.id } })}
      />
    </div>
  )
}

function FlowRail({
  origin,
  destination,
}: {
  origin: string
  destination: string
}) {
  const t = useTranslations("transfers.flow")
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LocationPill label={origin} />
      <span className="text-muted-foreground rtl:rotate-180" aria-hidden>
        →
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm font-medium text-muted-foreground">
        <Truck className="size-4" />
        {t("inTransit")}
      </span>
      <span className="text-muted-foreground rtl:rotate-180" aria-hidden>
        →
      </span>
      <LocationPill label={destination} />
    </div>
  )
}

function ProductsTable({
  transfer,
  quantities,
  locName,
  managing,
  mngRec,
  mngRej,
  setManageRec,
  setManageRej,
  onCommitQty,
  locale,
}: {
  transfer: Transfer
  quantities: Record<string, number>
  locName: (id: string | null | undefined) => string
  managing: boolean
  mngRec: (ln: TransferLine) => number
  mngRej: (ln: TransferLine) => number
  setManageRec: (ln: TransferLine, v: number) => void
  setManageRej: (ln: TransferLine, v: number) => void
  onCommitQty: (lineId: string, qty: number) => void
  locale: string
}) {
  const tProd = useTranslations("transfers.productsTable")
  const status = transfer.status
  const phase: "pre" | "transit" | "done" | "cancelled" =
    status === "DRAFT" || status === "READY_TO_SHIP"
      ? "pre"
      : status === "SENT" || status === "PARTIAL"
        ? "transit"
        : status === "RECEIVED"
          ? "done"
          : "cancelled"
  const isDraft = status === "DRAFT"
  const srcName = transfer.source_location_id
    ? locName(transfer.source_location_id)
    : tProd("inTransit")
  const dstName = transfer.destination_location_id
    ? locName(transfer.destination_location_id)
    : "—"
  const moveHeader = phase === "pre" ? tProd("move") : tProd("moved")
  const destHeader = phase === "transit" ? tProd("inTransit") : dstName

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2.5 text-start font-medium">
              {tProd("title")}
            </th>
            <th className="px-3 py-2.5 text-center font-medium">{moveHeader}</th>
            <th className="px-3 py-2.5 text-end font-medium">{srcName}</th>
            <th className="px-3 py-2.5 text-end font-medium">{destHeader}</th>
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((ln) => {
            const src = ln.available_at_source ?? 0
            const dst = ln.available_at_destination ?? 0
            const rem = remainingOf(ln)
            // Staged quantity (from the form) overlaid on the server value.
            const effQty = quantities[ln.id] ?? ln.quantity
            const warnDest =
              !!transfer.destination_location_id &&
              dst === 0 &&
              (phase === "pre" || phase === "transit")
            return (
              <tr key={ln.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-3">
                  <LineItemCell line={ln} locale={locale} compact />
                  {warnDest && (
                    <div className="mt-1 flex items-center gap-1 ps-12 text-xs text-amber-600">
                      <AlertTriangle className="size-3.5" />
                      {tProd("doesntFulfill", {
                        location: locName(transfer.destination_location_id),
                      })}
                    </div>
                  )}
                </td>

                {/* Move / Moved */}
                <td className="px-3 py-3 text-center tabular-nums">
                  {managing ? (
                    <span>{ln.quantity}</span>
                  ) : isDraft ? (
                    <Input
                      // Controlled by the form's staged quantity, so Discard
                      // (reset) restores it visually and there's no uncontrolled
                      // defaultValue churn.
                      type="number"
                      min={1}
                      value={effQty}
                      onChange={(e) =>
                        onCommitQty(ln.id, Number(e.target.value) || 1)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          (e.target as HTMLInputElement).blur()
                      }}
                      className="mx-auto h-8 w-20 text-center tabular-nums"
                    />
                  ) : (
                    ln.quantity
                  )}
                </td>

                {/* Source column */}
                <td className="px-3 py-3 text-end tabular-nums">
                  {!transfer.source_location_id ? (
                    "—"
                  ) : phase === "pre" ? (
                    <ImpactCell from={src} to={src - effQty} />
                  ) : phase === "transit" || phase === "done" ? (
                    <ImpactCell from={src + ln.quantity} to={src} muted />
                  ) : (
                    src
                  )}
                </td>

                {/* Destination / In transit column */}
                <td className="px-3 py-3 text-end tabular-nums">
                  {managing && phase === "done" ? (
                    <ManageInputs
                      ln={ln}
                      rec={mngRec(ln)}
                      rej={mngRej(ln)}
                      onRec={(v) => setManageRec(ln, v)}
                      onRej={(v) => setManageRej(ln, v)}
                    />
                  ) : !transfer.destination_location_id ? (
                    "—"
                  ) : phase === "pre" ? (
                    <ImpactCell from={dst} to={dst + effQty} positive />
                  ) : phase === "transit" ? (
                    <ImpactCell from={0} to={rem} positive />
                  ) : phase === "done" ? (
                    <ImpactCell
                      from={dst - ln.received_quantity}
                      to={dst}
                      positive
                    />
                  ) : (
                    dst
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ManageInputs({
  ln,
  rec,
  rej,
  onRec,
  onRej,
}: {
  ln: TransferLine
  rec: number
  rej: number
  onRec: (v: number) => void
  onRej: (v: number) => void
}) {
  const t = useTranslations("transfers.detail")
  return (
    <div className="flex items-center justify-end gap-2">
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        {t("accept")}
        <Input
          type="number"
          min={0}
          max={ln.quantity}
          value={rec}
          onChange={(e) => onRec(Number(e.target.value) || 0)}
          className="h-8 w-16 text-center tabular-nums"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        {t("reject")}
        <Input
          type="number"
          min={0}
          max={ln.quantity}
          value={rej}
          onChange={(e) => onRej(Number(e.target.value) || 0)}
          className="h-8 w-16 text-center tabular-nums"
        />
      </label>
    </div>
  )
}

function ImpactCell({
  from,
  to,
  positive = false,
  muted = false,
}: {
  from: number
  to: number
  positive?: boolean
  muted?: boolean
}) {
  const negative = !positive && to < 0
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span className="text-muted-foreground">{from}</span>
      <span className="text-muted-foreground rtl:rotate-180">→</span>
      <span
        className={cn(
          muted
            ? "font-medium"
            : negative
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
