"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { centsToMajor, majorToCents } from "@/shared/lib/format"
import {
  GET_ORDER_SHIPMENTS,
  GET_ORDER_SHIPPING_ECONOMICS,
  SET_SHIPMENT_ACTUAL_COST,
} from "../api"
import type { Shipment, ShipmentMutationResponse } from "../types"

/**
 * What the carrier billed for this shipment.
 *
 * Available whatever the shop's shipping mode, and that is the point: a shop
 * that delivers its own orders paid a driver and knows what it paid, so
 * shipping margin does not wait on a carrier integration.
 *
 * Saving here marks the figure `manual`. It may overwrite one a carrier
 * reported — the merchant holding the invoice is the better authority — but the
 * source flips with it, so a later disagreement is answerable.
 */
export function ShipmentCostDialog({
  shipment,
  open,
  onOpenChange,
}: {
  shipment: Shipment
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("shipments.costDialog")
  const client = useApolloClient()

  // Seeded from the server value each time the dialog opens, compared against
  // the row it belongs to — the adjust-during-render pattern, so the input
  // never shows the previous shipment's figure for a frame.
  const [seededFrom, setSeededFrom] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const seedKey = open ? shipment.id : null
  if (seedKey !== seededFrom) {
    setSeededFrom(seedKey)
    setAmount(
      typeof shipment.actual_cost_cents === "number"
        ? String(centsToMajor(shipment.actual_cost_cents))
        : "",
    )
  }

  const [save, { loading }] = useMutation<{
    setShipmentActualCost: ShipmentMutationResponse
  }>(SET_SHIPMENT_ACTUAL_COST)

  const parsed = Number(amount)
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0

  const submit = async () => {
    if (!valid) return
    try {
      const res = await save({
        variables: { id: shipment.id, cost_cents: majorToCents(parsed) },
      })
      if (!res.data?.setShipmentActualCost?.success) {
        sileo.error({
          title: res.data?.setShipmentActualCost?.message ?? t("failed"),
        })
        return
      }
      await client.refetchQueries({
        include: [GET_ORDER_SHIPMENTS, GET_ORDER_SHIPPING_ECONOMICS],
      })
      sileo.success({ title: t("saved") })
      onOpenChange(false)
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="shipment-cost">{t("amount")}</FieldLabel>
          <Input
            id="shipment-cost"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          {/*
            Zero is a real figure meaning the shipment cost nothing. Leaving the
            field empty is different — it means the invoice has not arrived —
            and the two must not be conflated, so the empty case simply cannot
            be saved rather than being silently stored as 0.
          */}
          <p className="text-xs text-muted-foreground">{t("zeroNote")}</p>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={!valid || loading} onClick={() => void submit()}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
