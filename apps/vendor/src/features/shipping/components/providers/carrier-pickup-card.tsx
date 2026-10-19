"use client"

import { useState } from "react"
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

import { validationMessage } from "@/shared/lib/validation-errors"
import {
  CheckCircle2Icon,
  Loader2Icon,
  MapPinIcon,
  PackageIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { SettingsCard } from "@/features/settings/components/settings-card"
import { GET_INVENTORY_LOCATIONS } from "@/features/inventory/api/queries"
import { formatList } from "../../lib/zones"
import {
  ENABLE_CARRIER_PICKUP,
  GET_SHIPPING_PROVIDER_LOCATIONS,
} from "../../providers-api"
import type {
  EnableCarrierPickupResponse,
  InventoryLocationsLiteResponse,
  ProviderLocationsResponse,
} from "../../providers-types"

/**
 * Which warehouses can be collected from by the carrier.
 *
 * **This card replaces the one that asked merchants to type a code.** The
 * merchant does own the carrier account, so in principle they could go and
 * read a pickup code out of it — but only after creating the location there
 * by hand, in a second dashboard, and transcribing an id between the two. A
 * mistyped character produced a booking that failed on `pickupLocationCode`
 * with no hint of which warehouse was wrong.
 *
 * So they press a button instead: we register the warehouse in THEIR account
 * and store the code we get back. The code is an implementation detail of the
 * carrier's API, not something a merchant should be copying around.
 *
 * The card's shape follows the one thing a merchant needs to know: **which of
 * my warehouses can actually ship?** Ready ones are stated plainly; the rest
 * lead with the single next action — register it, or go add the field it is
 * missing first. An unregistered warehouse does not degrade gracefully (the
 * server refuses to ship from it rather than picking another), so the gap is
 * shown here instead of surfacing when an order cannot be fulfilled.
 */
export function CarrierPickupCard() {
  const t = useTranslations("settings.shipping.pickup")
  const locale = useLocale()
  const client = useApolloClient()

  const locationsQuery = useQuery<InventoryLocationsLiteResponse>(
    GET_INVENTORY_LOCATIONS,
    { fetchPolicy: "cache-and-network" },
  )
  const mappingsQuery = useQuery<ProviderLocationsResponse>(
    GET_SHIPPING_PROVIDER_LOCATIONS,
    { fetchPolicy: "cache-and-network" },
  )

  // Which row is mid-flight. A set rather than one id: registering is a
  // network call per warehouse and a merchant with several will press more
  // than one before the first returns.
  const [pending, setPending] = useState<Set<string>>(new Set())

  const [enablePickup] = useMutation<EnableCarrierPickupResponse>(
    ENABLE_CARRIER_PICKUP,
  )

  const locations = (locationsQuery.data?.inventoryLocations?.data ?? []).filter(
    (l) => l.is_active,
  )
  const mapped = new Set(
    (mappingsQuery.data?.shippingProviderLocations?.data ?? [])
      .filter((m) => m.is_enabled)
      .map((m) => m.location_id),
  )

  async function register(id: string, name: string) {
    setPending((p) => new Set(p).add(id))
    try {
      const res = await enablePickup({ variables: { input: { location_id: id } } })
      const created = res.data?.enableCarrierPickup?.created
      sileo.success({
        // Idempotent: saying "registered" again for a warehouse that already
        // was would imply something happened twice.
        title: created
          ? t("readyToast", { name })
          : t("alreadyRegistered", { name }),
      })
      await client.refetchQueries({ include: [GET_SHIPPING_PROVIDER_LOCATIONS] })
    } catch (error) {
      // The server names the missing field (national address, phone, the
      // owner's email) and the fix for each — but it names them in
      // `extensions.validation_errors`, and `.message` is always the constant
      // "Validation failed". Reading the message was the generic sentence this
      // was written to avoid.
      sileo.error({ title: validationMessage(error, t("registerFailed")) })
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(id)
        return next
      })
    }
  }

  const loading = locationsQuery.loading && locations.length === 0
  const readyCount = locations.filter((l) => mapped.has(l.id)).length
  /** Warehouses a carrier cannot price an order from — see the callout below. */
  const cityless = locations.filter((l) => !l.city?.trim())

  return (
    <SettingsCard title={t("title")} description={t("description")}>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          {t("loading")}
        </p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            Lead with the count, because "can I ship at all?" is the question
            this card exists to answer — and zero ready warehouses means every
            carrier booking will refuse.
          */}
          {readyCount === 0 && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("noneReady")}</span>
            </p>
          )}

          {/*
            A city-less warehouse is not a cosmetic gap, and this is the one
            place a merchant can see it. Carriers price on the origin city as a
            STRING, so a warehouse without one cannot be quoted — and because
            the quote is all-or-nothing across an order's parcels (a leg
            dropped would total it short by that parcel), one such warehouse
            silently removes every shipping company from checkout. That is
            exactly how a shop with carriers switched on, every carrier
            enabled and a registered pickup point showed a customer no
            delivery options at all.
          */}
          {cityless.length > 0 && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {cityless.length === 1
                  ? t("citylessOne", { name: cityless[0]!.name })
                  : t("citylessMany", {
                      count: cityless.length,
                      names: formatList(
                        cityless.map((l) => l.name),
                        locale,
                      ),
                    })}
              </span>
            </p>
          )}

          <ul className="flex flex-col divide-y divide-border">
            {locations.map((location) => {
              const isReady = mapped.has(location.id)
              const isPending = pending.has(location.id)
              const place = [location.city, location.country]
                .filter(Boolean)
                .join(", ")

              return (
                <li
                  key={location.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md border",
                        isReady
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : "border-border bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {isReady ? (
                        <CheckCircle2Icon className="size-4" />
                      ) : (
                        <PackageIcon className="size-4" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {location.name}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {place ? (
                          <>
                            <MapPinIcon className="size-3" />
                            {place}
                          </>
                        ) : (
                          t("noCity")
                        )}
                      </p>
                    </div>
                  </div>

                  {isReady ? (
                    // Not a button. There is nothing to undo here — the pickup
                    // location exists at the carrier and cannot be deleted, so
                    // offering "disable" would promise a reversal we cannot
                    // perform.
                    <span className="shrink-0 text-xs font-medium text-emerald-600">
                      {t("ready")}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => void register(location.id, location.name)}
                      className="shrink-0"
                    >
                      {isPending ? (
                        <>
                          <Loader2Icon className="size-3.5 animate-spin" />
                          {t("registering")}
                        </>
                      ) : (
                        t("enable")
                      )}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>

          <p className="text-xs text-muted-foreground">{t("requirements")}</p>
        </div>
      )}
    </SettingsCard>
  )
}
