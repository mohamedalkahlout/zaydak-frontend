"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  useSuspenseQuery,
  useMutation,
  useApolloClient,
} from "@apollo/client/react"
import { GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import { DELETE_INVENTORY_LOCATION } from "@/features/inventory/api"
import { Button } from "@repo/ui/components/button"
import { Card } from "@repo/ui/components/card"
import { Badge } from "@repo/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Table2,
  MoreHorizontal,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { sileo } from "sileo"

import { validationMessage } from "@/shared/lib/validation-errors"
import { LocationFormDialog } from "./location-form-dialog"

type Location = {
  id: string
  name: string
  shop_id: string
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  is_default: boolean
  is_active: boolean
  fulfills_online_orders: boolean
  created_at: string
  updated_at: string
}

type LocationsQueryShape = {
  inventoryLocations: { success: boolean; data: Location[] }
}

/**
 * Inventory Locations management. Mirrors Shopify's Settings → Locations page.
 *
 * - Default location is read-only-ish: can't delete (server enforces).
 * - Locations with `fulfills_online_orders = false` are skipped when SALE
 *   adjustments pick a destination — surfaced as a chip so vendors know.
 * - Delete confirms inline; server rejects if the location still holds stock.
 */
export function LocationsPage() {
  const t = useTranslations("inventory.locations")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const client = useApolloClient()
  const { data } = useSuspenseQuery<LocationsQueryShape>(GET_INVENTORY_LOCATIONS)
  const locations = data?.inventoryLocations?.data ?? []

  const [editing, setEditing] = useState<Location | null>(null)
  const [creating, setCreating] = useState(false)

  const [deleteLocation, { loading: deleting }] = useMutation(
    DELETE_INVENTORY_LOCATION,
    {
      onCompleted: () => {
        sileo.success({ title: t("deleted") })
        void client.refetchQueries({ include: [GET_INVENTORY_LOCATIONS] })
      },
      onError: (err) => {
        // The refusal is specific and actionable — "still holds stock in 3
        // level(s), transfer or zero out first" — and it lives in
        // `extensions.validation_errors`. `err.message` is the constant
        // "Validation failed", which tells a merchant nothing about a delete
        // they are about to retry with the same result.
        sileo.error({
          title: validationMessage(err, t("deleteFailed")),
        })
      },
    }
  )

  function onDelete(loc: Location) {
    if (loc.is_default) {
      sileo.error({ title: t("defaultCannotDelete") })
      return
    }
    if (!window.confirm(t("confirmDelete", { name: loc.name }))) {
      return
    }
    void deleteLocation({ variables: { id: loc.id } })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          {shopSlug && (
            <Link
              href={`/store/${shopSlug}/products/inventory`}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {t("back")}
            </Link>
          )}
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {shopSlug && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link href={`/store/${shopSlug}/products/inventory/bulk`} />
              }
            >
              <Table2 className="size-4" />
              {t("bulkEdit")}
            </Button>
          )}
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
      </div>

      <Card className="divide-y divide-border overflow-hidden p-0">
        {locations.map((loc) => {
          const address = [loc.address_line1, loc.city, loc.country]
            .filter(Boolean)
            .join(", ")
          return (
            <div
              key={loc.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="size-4.5" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-medium">{loc.name}</h3>
                  {loc.is_default && (
                    <Badge variant="secondary">{t("default")}</Badge>
                  )}
                  {!loc.is_active && (
                    <Badge variant="outline">{t("inactive")}</Badge>
                  )}
                </div>
                {(address || loc.phone) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {address}
                      </span>
                    )}
                    {loc.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {loc.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <StatusDot active={loc.is_active} online={loc.fulfills_online_orders} />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label={t("actions")} />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(loc)}>
                    <Pencil className="size-4" />
                    {t("edit")}
                  </DropdownMenuItem>
                  {!loc.is_default && (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deleting}
                      onClick={() => onDelete(loc)}
                    >
                      <Trash2 className="size-4" />
                      {t("delete")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </Card>

      <LocationFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
      />
      {editing && (
        <LocationFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          mode="edit"
          location={editing}
        />
      )}
    </div>
  )
}

/**
 * Compact, dot-based fulfillment status — replaces the louder colored badges.
 * Inactive trumps the online flag (a turned-off location can't fulfill).
 */
function StatusDot({ active, online }: { active: boolean; online: boolean }) {
  const t = useTranslations("inventory.locations")
  const state = !active
    ? { dot: "bg-muted-foreground/40", text: t("inactive"), tone: "text-muted-foreground" }
    : online
      ? { dot: "bg-emerald-500", text: t("onlineEnabled"), tone: "text-muted-foreground" }
      : { dot: "bg-amber-500", text: t("noOnlineOrders"), tone: "text-amber-600 dark:text-amber-400" }

  return (
    <span
      className={cn(
        "hidden shrink-0 items-center gap-1.5 text-xs font-medium sm:inline-flex",
        state.tone
      )}
    >
      <span className={cn("size-1.5 rounded-full", state.dot)} />
      {state.text}
    </span>
  )
}
