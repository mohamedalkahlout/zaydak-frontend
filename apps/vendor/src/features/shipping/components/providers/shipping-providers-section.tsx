"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useQuery, useSuspenseQuery } from "@apollo/client/react"

import {
  GET_SHIPPING_PROVIDER_ACCOUNTS,
  GET_SHIPPING_PROVIDER_CATALOG,
  GET_SHOP_SHIPPING_SETTINGS,
} from "../../providers-api"
import type {
  ProviderAccountsResponse,
  ProviderCatalogResponse,
  ShopShippingSettingsResponse,
} from "../../providers-types"
import { accountIsUsable } from "../../providers-types"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { DeliveryChannelsCard } from "./delivery-channels-card"
import { CarrierAccountCard } from "./carrier-account-card"
import { CarrierSelectionCard } from "./carrier-selection-card"
import { CarrierPickupCard } from "./carrier-pickup-card"
import { SHOP_COUNTRY_CAPABILITIES } from "@/features/shops/api"

/**
 * Who delivers — the half of this screen that is not pricing.
 *
 * **The screen used to ask the same question twice, in two contradicting
 * ways.** A "Shipping method" card offered an exclusive choice — *I deliver*
 * OR *a carrier delivers* — directly above a card saying both could be
 * offered at once and the customer picks. Both were live, and a merchant
 * reading them in order was told the opposite thing twice.
 *
 * The exclusive framing is the one that went. It described how a shipment is
 * EXECUTED, which stopped being a shop-wide setting the moment the customer's
 * pick started deciding it per order — `Shop.shipping_mode` survives only as
 * the fallback for orders frozen before that existed. What is left is the
 * question a merchant actually has: **what may a customer choose from?**
 *
 * So this renders one group per channel, and each channel's own settings sit
 * INSIDE it rather than floating as sibling cards.
 *
 * ## The order of the carrier cards is the setup order
 *
 * Each merchant connects their OWN carrier account, so nothing below the
 * account card can be answered before it: which carriers to offer is a
 * question about that account's contracts, and a warehouse is registered as a
 * pickup location IN it. Rendering them early would show a merchant an empty
 * carrier list and a register button that fails, with no indication that the
 * missing piece is one card above.
 *
 *     connect + verify  →  which carriers  →  which warehouses
 *
 * So the two dependent cards appear only once a carrier is usable — the
 * server's own `carrier_available`, which is enabled AND verified, the same
 * rule it enforces at booking time.
 */
export function ShippingProvidersSection() {
  const t = useTranslations("settings.shipping.carrier")
  const locale = useLocale()

  // Suspense reader so the server page's `PreloadQuery` streams the pane with
  // data — a plain `useQuery` would not suspend and the SSR pass would ship
  // loading placeholders (the storefront's documented trap).
  const settingsQuery = useSuspenseQuery<ShopShippingSettingsResponse>(
    GET_SHOP_SHIPPING_SETTINGS,
    { fetchPolicy: "cache-and-network" },
  )
  const capsQuery = useQuery<{
    shopCountryCapabilities: {
      data?: {
        allowed_delivery_channels: string[]
        effective_carrier_delivery: boolean
      }
    }
  }>(SHOP_COUNTRY_CAPABILITIES, { fetchPolicy: "cache-first" })
  const carrierAllowed =
    capsQuery.data?.shopCountryCapabilities?.data?.allowed_delivery_channels?.includes(
      "CARRIER",
    ) ?? true

  const catalogQuery = useQuery<ProviderCatalogResponse>(
    GET_SHIPPING_PROVIDER_CATALOG,
  )
  const accountsQuery = useQuery<ProviderAccountsResponse>(
    GET_SHIPPING_PROVIDER_ACCOUNTS,
    { fetchPolicy: "cache-and-network" },
  )

  const settings = settingsQuery.data?.shopShippingSettings?.data
  const serverCarrierOn = settings?.offers_carrier_delivery ?? false

  /*
    The STAGED switch, mirrored up from the channels card.

    The channel toggle stages locally behind the global save bar, like every
    other edit in this app — but the carrier cards below were gated on the
    SAVED value, so flipping the switch on showed its warning while the
    credentials form it points at stayed hidden until Save was pressed. Nothing
    said so. A merchant saw a switch that was on, a warning telling them
    something was not connected, and no field with which to connect it.

    Reset by identity whenever `settings` changes, using adjust-state-during-
    render rather than an effect: a save refetches, the object is new, and the
    staged value has been superseded by the server's.
  */
  const [seededFrom, setSeededFrom] = useState<typeof settings>(undefined)
  const [stagedCarrierOn, setStagedCarrierOn] = useState<boolean | null>(null)
  if (seededFrom !== settings) {
    setSeededFrom(settings)
    setStagedCarrierOn(null)
  }
  const carrierOn = stagedCarrierOn ?? serverCarrierOn

  const catalog = catalogQuery.data?.shippingProviderCatalog?.data ?? []
  const accounts = accountsQuery.data?.shippingProviderAccounts?.data ?? []
  /*
    Whether this shop has a carrier that could book — enabled AND verified.

    `carrier_available`, not `provider_ready`: the latter is always true for a
    merchant-managed shop, so it says nothing about whether a carrier is behind
    it — and such a shop can still offer carrier prices at checkout. It is the
    server's own answer rather than one computed here from the account rows,
    so the screen cannot disagree with what booking would decide.
  */
  const carrierReady =
    settings?.carrier_available ?? accounts.some(accountIsUsable)

  return (
    <>
      <DeliveryChannelsCard
        settings={settings}
        // Whether a carrier could book at all. NOT `settings.provider_ready`,
        // which is always true for a merchant-managed shop and would fire the
        // card's "connected but switched off" warning for every shop that
        // simply delivers its own orders.
        carrierReady={carrierReady}
        carrierAllowed={carrierAllowed}
        onCarrierStaged={setStagedCarrierOn}
      />

      {/*
        While the channel is on, OR while an account exists.

        The second half matters as much as the first. Gating purely on the
        channel meant a merchant who turned it off could no longer see, rotate
        or delete the credentials they had already stored — the switch is about
        what CUSTOMERS are offered, and it should not hide an account that is
        still connected. A shop that has neither is shown nothing, which is the
        case the original gate was written for.

        CountryProfile may forbid CARRIER entirely (Palestine launch).
      */}
      {carrierAllowed && (carrierOn || accounts.length > 0) && (
        <>
          {/*
            One card per carrier this server can talk to. The form itself is
            drawn from the server's field catalog, so a carrier added on the
            back-end costs this file nothing.
          */}
          {catalog.map((spec) => (
            <CarrierAccountCard
              key={spec.provider}
              spec={spec}
              account={accounts.find((a) => a.provider === spec.provider)}
              locale={locale}
            />
          ))}

          {/*
            The empty case is worth stating outright rather than leaving a
            gap: a merchant seeing nothing here would go looking for the
            setting they were told to fill in.
          */}
          {!catalogQuery.loading && catalog.length === 0 && (
            <SettingsCard
              title={t("noCarriersTitle")}
              description={t("noCarriersBody")}
            >
              <p className="text-sm text-muted-foreground">
                {t("noCarriersHint")}
              </p>
            </SettingsCard>
          )}

          {carrierReady ? (
            <>
              <CarrierSelectionCard />
              <CarrierPickupCard />
            </>
          ) : (
            /*
              Absence is ambiguous — a merchant who cannot find the carrier
              list does not know whether it is missing, broken, or somewhere
              else. One line naming the blocker costs less than the support
              message it prevents.
            */
            catalog.length > 0 && (
              <p className="px-1 text-sm text-muted-foreground">
                {t("connectFirst")}
              </p>
            )
          )}
        </>
      )}
    </>
  )
}
