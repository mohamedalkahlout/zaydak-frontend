"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { TruckIcon, WarehouseIcon } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import type { Order } from "@/features/orders/types"
import { GET_ORDER_SHIPMENTS } from "../api"
import type { OrderShipmentsResponse } from "../types"
import { ShipmentRow } from "./shipment-row"
import { CreateShipmentDialog } from "./create-shipment-dialog"
import { ShippingEconomicsRow } from "./shipping-economics-row"

/**
 * The shipments on one order, grouped by the fulfillment each executes.
 *
 * Grouped rather than listed flat because that grouping IS the multi-location
 * story: a split order carries one fulfillment per warehouse, and the vendor
 * packing it needs to see "these three from Ramallah, those two from the main
 * warehouse" rather than five undifferentiated rows.
 *
 * A fulfillment with no shipment yet is shown as an empty group with its own
 * "create shipment" action. That is the case the screen exists for — before
 * this, a fulfillment could be created and then nothing in the product would
 * ever let a vendor book the carrier for it.
 */
export function OrderShipmentsCard({ order }: { order: Order }) {
  const t = useTranslations("shipments")
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  const { data, loading } = useQuery<OrderShipmentsResponse>(
    GET_ORDER_SHIPMENTS,
    { variables: { order_id: order.id }, fetchPolicy: "cache-and-network" },
  )

  const shipments = useMemo(
    () => data?.shipments?.data ?? [],
    [data],
  )

  const fulfillments = useMemo(() => order.fulfillments ?? [], [order])

  /**
   * Shipments keyed by the fulfillment they execute.
   *
   * Rows whose `fulfillment_id` is null are legacy — created before shipments
   * were re-parented — and are shown in their own group rather than dropped,
   * because a vendor looking for a shipment they remember creating must find
   * it somewhere.
   */
  const byFulfillment = useMemo(() => {
    const map = new Map<string, typeof shipments>()
    for (const s of shipments) {
      const key = s.fulfillment_id ?? "__unlinked__"
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return map
  }, [shipments])

  const unlinked = byFulfillment.get("__unlinked__") ?? []

  if (fulfillments.length === 0 && shipments.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <TruckIcon className="size-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-sm">
        <ShippingEconomicsRow orderId={order.id} />

        {loading && shipments.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          fulfillments.map((f) => {
            const rows = byFulfillment.get(f.id) ?? []
            const units = f.line_items.reduce((sum, l) => sum + l.quantity, 0)
            return (
              <div key={f.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <WarehouseIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">
                    {/* The location is what tells two otherwise-identical
                        fulfillment groups apart on a split order. */}
                    {f.location_name ?? t("unknownLocation")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("unitCount", { count: units })}
                  </span>
                  {rows.length === 0 && f.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ms-auto"
                      onClick={() => setCreatingFor(f.id)}
                    >
                      {t("createShipment")}
                    </Button>
                  )}
                </div>

                {rows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    {t("noShipmentYet")}
                  </p>
                ) : (
                  rows.map((s) => <ShipmentRow key={s.id} shipment={s} />)
                )}
              </div>
            )
          })
        )}

        {unlinked.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{t("unlinkedTitle")}</p>
            {unlinked.map((s) => (
              <ShipmentRow key={s.id} shipment={s} />
            ))}
          </div>
        )}
      </CardContent>

      <CreateShipmentDialog
        orderId={order.id}
        fulfillmentId={creatingFor}
        open={creatingFor !== null}
        onOpenChange={(open) => !open && setCreatingFor(null)}
      />
    </Card>
  )
}
