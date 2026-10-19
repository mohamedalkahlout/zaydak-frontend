"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  BoxIcon,
  ChevronDownIcon,
  FileTextIcon,
  Loader2,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import {
  CANCEL_SHIPMENT,
  GET_ORDER_SHIPMENTS,
  GET_ORDER_SHIPPING_ECONOMICS,
  REFRESH_SHIPMENT_TRACKING,
} from "../api"
import {
  canCancel,
  canRefreshTracking,
  totalWeightGrams,
  type Shipment,
  type ShipmentMutationResponse,
} from "../types"
import { ShipmentCostDialog } from "./shipment-cost-dialog"

/**
 * One shipment: how it was executed, where it is, and what it cost.
 *
 * The history is collapsed by default. It is append-only and a carrier re-sends
 * everything on each poll, so it is the longest thing here and the least often
 * needed — but when a customer asks why a parcel sat for three days, it is the
 * only thing that answers.
 */
export function ShipmentRow({ shipment }: { shipment: Shipment }) {
  const t = useTranslations("shipments")
  // Carriers report statuses this app has no words for. The raw value beats
  // the `shipments.status.<value>` path next-intl renders for a missing key —
  // `t(key, { fallback })` passed a message argument, not a fallback.
  const label = (key: string, raw: string) => (t.has(key) ? t(key) : raw)
  const client = useApolloClient()
  const [open, setOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)

  const [cancel, { loading: cancelling }] =
    useMutation<{ cancelShipment: ShipmentMutationResponse }>(CANCEL_SHIPMENT)
  const [refresh, { loading: refreshing }] = useMutation<{
    refreshShipmentTracking: ShipmentMutationResponse
  }>(REFRESH_SHIPMENT_TRACKING)

  const reload = () =>
    client.refetchQueries({
      include: [GET_ORDER_SHIPMENTS, GET_ORDER_SHIPPING_ECONOMICS],
    })

  const runCancel = async () => {
    try {
      const res = await cancel({ variables: { id: shipment.id } })
      if (!res.data?.cancelShipment?.success) {
        sileo.error({
          title: res.data?.cancelShipment?.message ?? t("cancelFailed"),
        })
        return
      }
      await reload()
      sileo.success({ title: t("cancelled") })
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  const runRefresh = async () => {
    try {
      const res = await refresh({ variables: { id: shipment.id } })
      if (!res.data?.refreshShipmentTracking?.success) {
        sileo.error({
          title:
            res.data?.refreshShipmentTracking?.message ?? t("refreshFailed"),
        })
        return
      }
      await reload()
      sileo.success({ title: t("refreshed") })
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  const events = shipment.tracking_events ?? []
  const boxes = shipment.packages ?? []
  const weight = totalWeightGrams(shipment)
  const busy = cancelling || refreshing
  const cancelledLook = shipment.status === "cancelled"

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        cancelledLook && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                shipment.status === "delivered"
                  ? "secondary"
                  : cancelledLook
                    ? "outline"
                    : "default"
              }
            >
              {label(`status.${shipment.status}`, shipment.status)}
            </Badge>
            {/*
              Names WHO carried it. `manual` is the merchant delivering their
              own order — a real business mode, not a missing carrier.
            */}
            <span className="text-xs text-muted-foreground">
              {shipment.provider_slug === "manual"
                ? t("providerManual")
                : (shipment.delivery_company ??
                  shipment.provider_slug ??
                  t("providerUnknown"))}
            </span>
          </div>

          {shipment.tracking_number && (
            <p className="mt-1 truncate font-mono text-xs">
              {shipment.tracking_url ? (
                <a
                  href={shipment.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {shipment.tracking_number}
                </a>
              ) : (
                shipment.tracking_number
              )}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {boxes.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <BoxIcon className="size-3" />
                {t("boxCount", { count: boxes.length })}
                {weight !== null && ` · ${(weight / 1000).toFixed(2)} kg`}
              </span>
            )}
            {shipment.label_url && (
              <a
                href={shipment.label_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                <FileTextIcon className="size-3" />
                {t("label")}
              </a>
            )}
            <span>{formatDate(shipment.shipped_at ?? shipment.created_at)}</span>
          </div>
        </div>

        {/*
          Cost sits with the shipment because that is what the carrier bills.
          `null` is rendered as "not recorded", never as zero — a missing
          invoice is not a free delivery.
        */}
        <button
          type="button"
          onClick={() => setCostOpen(true)}
          className="shrink-0 rounded-md border border-transparent px-2 py-1 text-end text-xs hover:border-border hover:bg-muted/50"
        >
          <span className="block text-muted-foreground">{t("cost")}</span>
          <span className="font-medium">
            {typeof shipment.actual_cost_cents === "number"
              ? formatMoneyCents(shipment.actual_cost_cents)
              : t("costUnknown")}
          </span>
          {shipment.cost_source && (
            <span className="block text-[10px] text-muted-foreground">
              {label(`costSource.${shipment.cost_source}`, shipment.cost_source)}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
        {events.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
            className="text-xs"
          >
            <ChevronDownIcon
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
            />
            {t("historyCount", { count: events.length })}
          </Button>
        )}
        <div className="ms-auto flex items-center gap-1">
          {canRefreshTracking(shipment) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              disabled={busy}
              onClick={() => void runRefresh()}
            >
              {refreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-3.5" />
              )}
              {t("refresh")}
            </Button>
          )}
          {canCancel(shipment) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-destructive"
              disabled={busy}
              onClick={() => void runCancel()}
            >
              {cancelling ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <XIcon className="size-3.5" />
              )}
              {t("cancel")}
            </Button>
          )}
        </div>
      </div>

      {open && events.length > 0 && (
        <ol className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {label(`status.${e.status}`, e.status)}
                  {/*
                    Whether a carrier said this or a person typed it. When the
                    two disagree, this is the first question asked.
                  */}
                  <span className="ms-1.5 font-normal text-muted-foreground">
                    {label(`source.${e.source}`, e.source)}
                  </span>
                </p>
                {e.description && (
                  <p className="text-muted-foreground">{e.description}</p>
                )}
              </div>
              <span className="shrink-0 text-muted-foreground">
                {formatDate(e.occurred_at)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <ShipmentCostDialog
        shipment={shipment}
        open={costOpen}
        onOpenChange={setCostOpen}
      />
    </div>
  )
}
