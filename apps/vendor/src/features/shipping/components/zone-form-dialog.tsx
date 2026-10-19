"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

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

import { CountriesPickerDialog } from "@/features/coupons/components/new/countries-picker-dialog"
import { countryLabel } from "@/features/coupons/components/new/_data/countries"
import {
  CREATE_SHIPPING_ZONE,
  GET_SHIPPING_ZONES,
  UPDATE_SHIPPING_ZONE,
} from "../api"
import { formatList, isCatchAll, otherCatchAll, textOf } from "../lib/zones"
import type { ShippingZone } from "../types"

/**
 * Create or edit one zone.
 *
 * A dialog with its own Save rather than the global contextual bar: this is
 * entity CRUD behind an explicit action, the same shape as the inventory
 * locations dialog, and nothing is persisted until the button is pressed — so
 * the no-auto-save rule holds without dragging the navbar bar into a modal.
 *
 * It refuses to save a second catch-all. The server has no such rule, and a
 * second one is never what a merchant meant from here: it matches exactly the
 * destinations the first already does, and only `priority` decides which is
 * charged while the other sits on the list looking live. The swap still works
 * — give the old catch-all its countries first, then clear this one's.
 */
export function ZoneFormDialog({
  open,
  zone,
  zones,
  onOpenChange,
  cityMatch = false,
  cityOptions = [],
}: {
  open: boolean
  zone?: ShippingZone
  /** Every zone the shop has, so the dialog can see the catch-all it would duplicate. */
  zones: ShippingZone[]
  onOpenChange: (open: boolean) => void
  /** CountryProfile.shipping_match === CITY — destinations are city codes. */
  cityMatch?: boolean
  cityOptions?: { code: string; name_ar: string; name_en: string }[]
}) {
  const t = useTranslations("settings.shipping")
  const tCommon = useTranslations("common")
  const tHeader = useTranslations("header")
  const locale = useLocale()
  const apollo = useApolloClient()

  const [name, setName] = useState("")
  const [countries, setCountries] = useState<string[]>([])
  const [cityCodes, setCityCodes] = useState<string[]>([])
  const [priority, setPriority] = useState("0")
  const [picking, setPicking] = useState(false)

  // Seed during render rather than from an effect: React discards this render
  // and re-runs with the seeded values, where an effect would commit one frame
  // showing the previous zone's name in the input.
  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    zone?: ShippingZone
  } | null>(null)
  if (!seededFrom || seededFrom.open !== open || seededFrom.zone !== zone) {
    setSeededFrom({ open, zone })
    if (open) {
      setName(zone ? textOf(zone.name) : "")
      setCountries(
        zone
          ? [...zone.countries]
          : cityMatch
            ? ["PS"]
            : [],
      )
      setCityCodes(zone ? [...(zone.city_codes ?? [])] : [])
      setPriority(String(zone?.priority ?? 0))
    }
  }

  const done = () => {
    void apollo.refetchQueries({ include: [GET_SHIPPING_ZONES] })
    onOpenChange(false)
  }
  const onError = (error: Error) => sileo.error({ title: error.message })

  const [create, createState] = useMutation(CREATE_SHIPPING_ZONE, {
    onCompleted: () => {
      sileo.success({ title: t("zoneCreated") })
      done()
    },
    onError,
  })
  const [update, updateState] = useMutation(UPDATE_SHIPPING_ZONE, {
    onCompleted: () => {
      sileo.success({ title: t("zoneUpdated") })
      done()
    },
    onError,
  })

  const saving = createState.loading || updateState.loading
  const trimmed = name.trim()

  const catchAll = isCatchAll({ countries })
  // Derived on every render, never stored — it is a function of the props and
  // the picked countries and nothing else. The zone being edited is excluded so
  // renaming the existing catch-all is not a conflict with itself.
  const conflict = catchAll ? otherCatchAll(zones, zone?.id) : null

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    // Enter in the name input submits the form whatever the button's
    // `disabled` says, so the refusal has to live here as well.
    if (!trimmed || conflict) return

    const parsedPriority = Number(priority)
    const shared = {
      // `name` is a multilang blob server-side. One field is written into both
      // locales so a zone never renders blank in Arabic — a zone name is a
      // vendor's own label, not customer-facing copy worth two inputs.
      name: { en: trimmed, ar: trimmed },
      countries: cityMatch ? ["PS"] : countries,
      city_codes: cityMatch ? cityCodes : [],
      priority: Number.isFinite(parsedPriority) ? Math.trunc(parsedPriority) : 0,
    }

    if (zone) {
      void update({ variables: { input: { id: zone.id, ...shared } } })
    } else {
      void create({ variables: { input: shared } })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>
                {zone ? t("editZoneTitle") : t("newZoneTitle")}
              </DialogTitle>
              <DialogDescription>{t("zoneDialogHint")}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <Field>
                <FieldLabel htmlFor="zone-name">{t("zoneName")}</FieldLabel>
                <Input
                  id="zone-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("zoneNamePlaceholder")}
                  autoFocus
                />
              </Field>

              {cityMatch ? (
                <Field>
                  <FieldLabel>{t("cities")}</FieldLabel>
                  <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                    {cityOptions.map((city) => {
                      const checked = cityCodes.includes(city.code)
                      const label =
                        locale.startsWith("ar") ? city.name_ar : city.name_en
                      return (
                        <label
                          key={city.code}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setCityCodes((prev) =>
                                checked
                                  ? prev.filter((c) => c !== city.code)
                                  : [...prev, city.code],
                              )
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cityCodes.length === 0
                      ? t("citiesEmpty")
                      : t("citiesHint")}
                  </p>
                </Field>
              ) : (
                <Field>
                  <FieldLabel>{t("countries")}</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="flex min-h-9 w-full items-center rounded-lg border border-border px-3 py-2 text-start text-sm hover:bg-muted"
                  >
                    {catchAll ? (
                      <span className="text-muted-foreground">
                        {t("countriesEmpty")}
                      </span>
                    ) : (
                      <span className="line-clamp-2">
                        {formatList(
                          countries.map((code) => countryLabel(code, locale)),
                          locale,
                        )}
                      </span>
                    )}
                  </button>
                  {conflict ? (
                    <p className="text-xs text-destructive">
                      {t("catchAllConflict", { name: textOf(conflict.name) })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {catchAll ? t("catchAllHint") : t("countriesHint")}
                    </p>
                  )}
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="zone-priority">{t("priority")}</FieldLabel>
                <Input
                  id="zone-priority"
                  type="number"
                  inputMode="numeric"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">
                  {t("priorityHint")}
                </p>
              </Field>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={saving || !trimmed || !!conflict}>
                {saving ? tHeader("saving") : tHeader("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CountriesPickerDialog
        open={picking}
        onOpenChange={setPicking}
        value={countries}
        onConfirm={(codes) => {
          setCountries(codes)
          setPicking(false)
        }}
      />
    </>
  )
}
