"use client"

import { useMemo, useState } from "react"
import { useQuery, useSuspenseQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  AlertTriangle,
  Globe2,
  Info,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { countryLabel } from "@/features/coupons/components/new/_data/countries"
import {
  GET_SHIPPING_RULES,
  GET_SHIPPING_ZONES,
  SHIPPING_RULES_VARIABLES,
} from "../api"
import { GET_SHOP_SHIPPING_SETTINGS } from "../providers-api"
import type { ShopShippingSettingsResponse } from "../providers-types"
import {
  diagnose,
  effectiveRate,
  formatList,
  isCatchAll,
  orderZones,
  shadowedRates,
  textOf,
} from "../lib/zones"
import type {
  ShippingRule,
  ShippingRulesResponse,
  ShippingZone,
  ShippingZonesResponse,
} from "../types"
import { ShippingProvidersSection } from "./providers/shipping-providers-section"
import { PackagesCard } from "./packages-card"
import { ZoneFormDialog } from "./zone-form-dialog"
import { RateFormDialog } from "./rate-form-dialog"
import { DeleteShippingDialog } from "./delete-shipping-dialog"
import {
  PALESTINE_CITIES,
  SHOP_COUNTRY_CAPABILITIES,
} from "@/features/shops/api"

/**
 * Settings → Shipping.
 *
 * The screen exists because there was no way to configure delivery at all: the
 * six mutations shipped with the API and nothing called them, so every shop had
 * zero zones and zero rates and `verifyCheckout` answered
 * `shipping_available: false` for every address on earth.
 *
 * It is built around making `selectShippingRule`'s behaviour visible rather
 * than just listing rows — see `lib/zones.ts` for the three ways a
 * configuration that *looks* right charges nothing.
 */
export function ShippingSection({ currency }: { currency?: string | null }) {
  const t = useTranslations("settings.shipping")
  const locale = useLocale()

  // Suspense readers, so the server page's `PreloadQuery` pays off: the pane
  // suspends during the RSC pass and streams with data instead of shipping a
  // skeleton the client fills in after hydration. `cache-and-network` keeps
  // the old freshness — a revisit renders the cache and revalidates behind it.
  const zonesQuery = useSuspenseQuery<ShippingZonesResponse>(
    GET_SHIPPING_ZONES,
    { fetchPolicy: "cache-and-network" },
  )
  const rulesQuery = useSuspenseQuery<ShippingRulesResponse>(
    GET_SHIPPING_RULES,
    { variables: SHIPPING_RULES_VARIABLES, fetchPolicy: "cache-and-network" },
  )

  const zones = useMemo(
    () => orderZones(zonesQuery.data?.shippingZones?.data ?? []),
    [zonesQuery.data],
  )
  const unzonedRules = useMemo(
    () => (rulesQuery.data?.shippingRules?.data ?? []).filter((r) => !r.zone_id),
    [rulesQuery.data],
  )
  /**
   * Which channels the shop offers. The same document `ShippingProvidersSection`
   * reads, so this is an Apollo cache hit rather than a second round trip.
   *
   * Every warning below is about the shop's OWN delivery, and without this the
   * pane told a carrier-only merchant in red that "no shipping is configured"
   * — under a working carrier list, with no zone they could add to silence it.
   */
  const settingsQuery = useSuspenseQuery<ShopShippingSettingsResponse>(
    GET_SHOP_SHIPPING_SETTINGS,
    { fetchPolicy: "cache-and-network" },
  )
  const capsQuery = useSuspenseQuery<{
    shopCountryCapabilities: {
      data?: { shipping_match: string; home_country: string }
    }
  }>(SHOP_COUNTRY_CAPABILITIES, { fetchPolicy: "cache-and-network" })
  const cityMatch =
    capsQuery.data?.shopCountryCapabilities?.data?.shipping_match === "CITY"
  const citiesQuery = useQuery<{
    palestineCities: {
      data: { code: string; name_ar: string; name_en: string }[]
    }
  }>(PALESTINE_CITIES, {
    skip: !cityMatch,
    fetchPolicy: "cache-first",
  })
  const cityOptions = citiesQuery.data?.palestineCities?.data ?? []
  const channels = useMemo(() => {
    const settings = settingsQuery.data?.shopShippingSettings?.data
    return {
      offersMerchantDelivery: settings?.offers_merchant_delivery,
      offersCarrierDelivery: settings?.offers_carrier_delivery,
    }
  }, [settingsQuery.data])

  const diagnostics = useMemo(
    () =>
      diagnose(zones, unzonedRules, channels, { domesticOnly: cityMatch }),
    [zones, unzonedRules, channels, cityMatch],
  )

  const [zoneDialog, setZoneDialog] = useState<{
    open: boolean
    zone?: ShippingZone
  }>({ open: false })
  const [rateDialog, setRateDialog] = useState<{
    open: boolean
    zoneId: string | null
    rule?: ShippingRule
  }>({ open: false, zoneId: null })
  const [deleting, setDeleting] = useState<{
    open: boolean
    kind: "zone" | "rate"
    id: string
    name: string
    /**
     * Set when a rate is the last one on its zone, and only from `ZoneRow` —
     * never from the unzoned card. Removing the last flat rate leaves the shop
     * `not_configured`, which checkout lets through with a warning; a zone
     * with no rate is a wall it refuses, so only that one is worth stopping.
     */
    zone?: { id: string; name: string }
  } | null>(null)
  // Hoisted to a const so the closure below keeps the narrowed type.
  const blockedZone = deleting?.zone ?? null

  return (
    <div className="flex flex-col gap-5">
      {/*
        What the customer may choose from, above what each choice costs. The
        zones below price ONE of those channels — the shop's own delivery — and
        say so in their own heading; carrier prices come from the carriers and
        no rate here can change them.

        The card stays visible even when that channel is switched off, and that
        is deliberate: rates are slow to rebuild, and a merchant pausing their
        own delivery for a week must not come back to an empty zone list.
      */}
      <ShippingProvidersSection />
      <PackagesCard />

      {diagnostics.length > 0 && (
        <div className="flex flex-col gap-2">
          {diagnostics.map((d) => (
            <Callout key={d.id} severity={d.severity}>
              {t(`diagnostics.${d.id}`, {
                count: d.count ?? 0,
                zones: formatList(d.zones ?? [], locale),
              })}
            </Callout>
          ))}
        </div>
      )}

      {/*
        Named for the channel it prices. Before this it read as "shipping
        rates" full stop, which in a shop offering carriers too invites the
        reading that these rates apply to them — they never do.
      */}
      <SettingsCard
        title={t("zonesTitle")}
        description={t("zonesDescription")}
        className="flex flex-col gap-3"
      >
        {zones.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="size-5" />}
            title={t("noZonesTitle")}
            body={t("noZonesBody")}
          />
        ) : (
          zones.map((zone) => (
            <ZoneRow
              key={zone.id}
              zone={zone}
              currency={currency}
              onEdit={() => setZoneDialog({ open: true, zone })}
              onDelete={() =>
                setDeleting({
                  open: true,
                  kind: "zone",
                  id: zone.id,
                  name: textOf(zone.name),
                })
              }
              onAddRate={() =>
                setRateDialog({ open: true, zoneId: zone.id })
              }
              onEditRate={(rule) =>
                setRateDialog({ open: true, zoneId: zone.id, rule })
              }
              onDeleteRate={(rule) =>
                setDeleting({
                  open: true,
                  kind: "rate",
                  id: rule.id,
                  name: textOf(rule.name),
                  // `zone.rules` already excludes soft-deleted rows, so one
                  // row means this rate is the only one checkout can offer.
                  zone:
                    zone.rules.length === 1
                      ? { id: zone.id, name: textOf(zone.name) }
                      : undefined,
                })
              }
            />
          ))
        )}

        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoneDialog({ open: true })}
          >
            <Plus />
            {t("addZone")}
          </Button>
        </div>
      </SettingsCard>

      {/* Unzoned rates only exist as a card when there are some — an empty
          "legacy" section would invite creating one, which is the wrong shape
          for any shop that has zones. */}
      {unzonedRules.length > 0 && (
        <SettingsCard
          title={t("unzonedTitle")}
          description={
            zones.length > 0 ? t("unzonedShadowedDesc") : t("unzonedActiveDesc")
          }
          className="flex flex-col gap-2"
        >
          {unzonedRules.map((rule) => (
            <RateRow
              key={rule.id}
              rule={rule}
              currency={currency}
              muted={zones.length > 0}
              onEdit={() =>
                setRateDialog({ open: true, zoneId: null, rule })
              }
              onDelete={() =>
                setDeleting({
                  open: true,
                  kind: "rate",
                  id: rule.id,
                  name: textOf(rule.name),
                })
              }
            />
          ))}
        </SettingsCard>
      )}

      {unzonedRules.length === 0 && zones.length === 0 && (
        <SettingsCard title={t("quickStartTitle")}>
          <p className="text-sm text-muted-foreground">{t("quickStartBody")}</p>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => setRateDialog({ open: true, zoneId: null })}
          >
            <Truck />
            {t("addFlatRate")}
          </Button>
        </SettingsCard>
      )}

      <ZoneFormDialog
        open={zoneDialog.open}
        zone={zoneDialog.zone}
        zones={zones}
        onOpenChange={(open) => setZoneDialog({ open, zone: zoneDialog.zone })}
        cityMatch={cityMatch}
        cityOptions={cityOptions}
      />
      <RateFormDialog
        open={rateDialog.open}
        zoneId={rateDialog.zoneId}
        rule={rateDialog.rule}
        currency={currency}
        onOpenChange={(open) =>
          setRateDialog({ ...rateDialog, open })
        }
      />
      {deleting && (
        <DeleteShippingDialog
          open={deleting.open}
          kind={deleting.kind}
          id={deleting.id}
          name={deleting.name}
          lastRateOfZone={blockedZone}
          onDeleteZoneInstead={
            blockedZone
              ? () =>
                  // Swapped in place with `open` kept true: closing and
                  // reopening would flash the dialog shut between the two.
                  setDeleting({
                    open: true,
                    kind: "zone",
                    id: blockedZone.id,
                    name: blockedZone.name,
                  })
              : undefined
          }
          onOpenChange={(open) =>
            setDeleting(open ? { ...deleting, open } : null)
          }
        />
      )}
    </div>
  )
}

function ZoneRow({
  zone,
  currency,
  onEdit,
  onDelete,
  onAddRate,
  onEditRate,
  onDeleteRate,
}: {
  zone: ShippingZone
  currency?: string | null
  onEdit: () => void
  onDelete: () => void
  onAddRate: () => void
  onEditRate: (rule: ShippingRule) => void
  onDeleteRate: (rule: ShippingRule) => void
}) {
  const t = useTranslations("settings.shipping")
  const locale = useLocale()

  const catchAll = isCatchAll(zone)
  const winner = effectiveRate(zone)
  const dead = shadowedRates(zone)

  const destinations = catchAll
    ? t("restOfWorld")
    : formatList(
        zone.countries.map((code) => countryLabel(code, locale)),
        locale,
      )

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {catchAll ? <Globe2 className="size-4" /> : <MapPin className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{textOf(zone.name)}</p>
            {catchAll && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-700 dark:text-emerald-400">
                {t("catchAllBadge")}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {destinations}
            {zone.states.length > 0 && ` · ${formatList(zone.states, locale)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={t("editZone")} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("deleteZone")}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {winner ? (
          <>
            <RateRow
              rule={winner}
              currency={currency}
              onEdit={() => onEditRate(winner)}
              onDelete={() => onDeleteRate(winner)}
            />
            {dead.map((rule) => (
              <RateRow
                key={rule.id}
                rule={rule}
                currency={currency}
                muted
                note={t("rateShadowed")}
                onEdit={() => onEditRate(rule)}
                onDelete={() => onDeleteRate(rule)}
              />
            ))}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("zoneHasNoRate")}</p>
        )}
        <div>
          <Button variant="ghost" size="xs" onClick={onAddRate}>
            <Plus />
            {t("addRate")}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RateRow({
  rule,
  currency,
  muted,
  note,
  onEdit,
  onDelete,
}: {
  rule: ShippingRule
  currency?: string | null
  muted?: boolean
  note?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useTranslations("settings.shipping")

  const money = (cents: number) => formatMoneyCents(cents, currency ?? "SAR")

  const summary =
    rule.type === "free"
      ? t("rateFree")
      : rule.type === "percentage"
        ? t("ratePercentage", { percent: rule.amount_bps / 100 })
        : rule.type === "weight_based"
          ? t("rateWeight", {
              base: money(rule.amount_cents),
              perKg: money(rule.per_kg_cents),
            })
          : t("rateFixed", { amount: money(rule.amount_cents) })

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2",
        muted && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{textOf(rule.name)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {summary}
          {rule.min_order_cents > 0 &&
            ` · ${t("freeOver", { amount: money(rule.min_order_cents) })}`}
          {note && ` · ${note}`}
        </p>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label={t("editRate")} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("deleteRate")}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

function Callout({
  severity,
  children,
}: {
  severity: "error" | "warning"
  children: React.ReactNode
}) {
  const Icon = severity === "error" ? AlertTriangle : Info
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm",
        severity === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-500/10 text-amber-900 dark:text-amber-300",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0">{children}</p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-8 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
    </div>
  )
}
