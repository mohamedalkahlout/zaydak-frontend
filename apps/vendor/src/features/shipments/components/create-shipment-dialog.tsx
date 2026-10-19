"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Loader2, PlusIcon, Trash2 } from "lucide-react"

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
import {
  CREATE_SHIPMENT,
  GET_ORDER_SHIPMENTS,
  GET_ORDER_SHIPPING_ECONOMICS,
} from "../api"
import type { ShipmentMutationResponse } from "../types"

interface BoxDraft {
  weight: string
  length: string
  width: string
  height: string
}

const emptyBox = (): BoxDraft => ({
  weight: "",
  length: "",
  width: "",
  height: "",
})

/**
 * Book a shipment for one fulfillment.
 *
 * Packages are optional. Omitting them books a single unmeasured box, which is
 * what every caller written before packages existed does — so a merchant who
 * does not weigh anything is not blocked from shipping.
 *
 * The carrier name is only accepted for merchant-managed delivery; a shipment
 * booked through a real carrier takes its name from the provider registry, so
 * the field is not offered as something that could contradict it.
 */
export function CreateShipmentDialog({
  orderId,
  fulfillmentId,
  open,
  onOpenChange,
}: {
  orderId: string
  fulfillmentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("shipments.createDialog")
  const client = useApolloClient()

  const [seededFrom, setSeededFrom] = useState<string | null>(null)
  const [tracking, setTracking] = useState("")
  const [carrier, setCarrier] = useState("")
  const [boxes, setBoxes] = useState<BoxDraft[]>([])

  const seedKey = open ? fulfillmentId : null
  if (seedKey !== seededFrom) {
    setSeededFrom(seedKey)
    setTracking("")
    setCarrier("")
    setBoxes([])
  }

  const [create, { loading }] = useMutation<{
    createShipment: ShipmentMutationResponse
  }>(CREATE_SHIPMENT)

  const num = (v: string): number | undefined => {
    const n = Number(v)
    return v.trim() !== "" && Number.isFinite(n) && n >= 0
      ? Math.round(n)
      : undefined
  }

  const submit = async () => {
    if (!fulfillmentId) return
    try {
      const packages = boxes
        .map((b) => ({
          weight_grams: num(b.weight),
          length_mm: num(b.length),
          width_mm: num(b.width),
          height_mm: num(b.height),
        }))
        // A box the merchant added and left entirely blank carries no
        // information; sending it would create an empty package row.
        .filter((b) => Object.values(b).some((v) => v !== undefined))

      const res = await create({
        variables: {
          input: {
            fulfillment_id: fulfillmentId,
            ...(tracking.trim() ? { tracking_number: tracking.trim() } : {}),
            ...(carrier.trim() ? { delivery_company: carrier.trim() } : {}),
            ...(packages.length > 0 ? { packages } : {}),
          },
        },
      })
      if (!res.data?.createShipment?.success) {
        sileo.error({
          title: res.data?.createShipment?.message ?? t("failed"),
        })
        return
      }
      await client.refetchQueries({
        include: [GET_ORDER_SHIPMENTS, GET_ORDER_SHIPPING_ECONOMICS],
      })
      sileo.success({ title: t("created") })
      onOpenChange(false)
    } catch (err) {
      // The server refuses rather than falling back when a shop is set to ship
      // through a carrier and has none working, or when the fulfillment's
      // location has no branch mapped. Those messages name what to fix.
      sileo.error({ title: (err as Error).message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="ship-tracking">{t("tracking")}</FieldLabel>
            <Input
              id="ship-tracking"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder={t("trackingPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("trackingHint")}</p>
          </Field>

          <Field>
            <FieldLabel htmlFor="ship-carrier">{t("carrier")}</FieldLabel>
            <Input
              id="ship-carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder={t("carrierPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("carrierHint")}</p>
          </Field>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("packages")}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBoxes((b) => [...b, emptyBox()])}
              >
                <PlusIcon className="size-3.5" />
                {t("addBox")}
              </Button>
            </div>
            {boxes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("noPackagesHint")}
              </p>
            ) : (
              boxes.map((b, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2"
                >
                  {(["weight", "length", "width", "height"] as const).map(
                    (k) => (
                      <div key={k} className="w-20">
                        <label className="text-[11px] text-muted-foreground">
                          {t(`box.${k}`)}
                        </label>
                        <Input
                          inputMode="numeric"
                          value={b[k]}
                          onChange={(e) =>
                            setBoxes((prev) =>
                              prev.map((x, xi) =>
                                xi === i ? { ...x, [k]: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                    ),
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      setBoxes((prev) => prev.filter((_, xi) => xi !== i))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={loading || !fulfillmentId} onClick={() => void submit()}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
