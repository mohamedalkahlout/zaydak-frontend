"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation, useApolloClient } from "@apollo/client/react"
import { CREATE_INVENTORY_LOCATION, UPDATE_INVENTORY_LOCATION } from "@/features/inventory/api"
import { GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { AppleSwitch } from "@repo/ui/components/apple-switch"
import { sileo } from "sileo"

import { NationalAddressField } from "./national-address-field"

interface LocationLike {
  id: string
  name: string
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  national_address_code?: string | null
  is_active: boolean
  fulfills_online_orders: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  location?: LocationLike
}

/**
 * Single dialog for both create + edit. `mode` toggles between calling
 * createInventoryLocation vs updateInventoryLocation; the form schema is
 * identical except `id` is omitted on create. Refetches the locations query
 * on success so the list updates without manual cache surgery.
 */
export function LocationFormDialog({
  open,
  onOpenChange,
  mode,
  location,
}: Props) {
  const t = useTranslations("inventory")
  const tCommon = useTranslations("common")
  const client = useApolloClient()
  const [name, setName] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [phone, setPhone] = useState("")
  const [nationalAddress, setNationalAddress] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [fulfillsOnline, setFulfillsOnline] = useState(true)

  // Seed the form each time the dialog opens, and re-seed if it is pointed at a
  // different row. Adjusted during render rather than from an effect: React
  // discards this render and re-runs immediately with the seeded values, where
  // an effect would first commit a frame showing the PREVIOUS row's values in
  // the inputs. Keyed on the same three values the dependency list carried.
  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    mode: typeof mode
    location: typeof location
  } | null>(null)

  if (
    !seededFrom ||
    seededFrom.open !== open ||
    seededFrom.mode !== mode ||
    seededFrom.location !== location
  ) {
    setSeededFrom({ open, mode, location })
    if (!open) {
      // nothing to seed while closed
    } else if (mode === "edit" && location) {
      setName(location.name)
      setAddressLine1(location.address_line1 ?? "")
      setCity(location.city ?? "")
      setCountry(location.country ?? "")
      setPhone(location.phone ?? "")
      setNationalAddress(location.national_address_code ?? "")
      setIsActive(location.is_active)
      setFulfillsOnline(location.fulfills_online_orders)
    } else {
      setName("")
      setAddressLine1("")
      setCity("")
      setCountry("")
      setPhone("")
      setNationalAddress("")
      setIsActive(true)
      setFulfillsOnline(true)
    }
  }

  const [createMutation, { loading: creating }] = useMutation(
    CREATE_INVENTORY_LOCATION,
    {
      onCompleted: () => {
        sileo.success({ title: t("locationForm.created") })
        void client.refetchQueries({ include: [GET_INVENTORY_LOCATIONS] })
        onOpenChange(false)
      },
      onError: (err) =>
        sileo.error({ title: err.message || t("locationForm.createFailed") }),
    }
  )

  const [updateMutation, { loading: updating }] = useMutation(
    UPDATE_INVENTORY_LOCATION,
    {
      onCompleted: () => {
        sileo.success({ title: t("locationForm.updated") })
        void client.refetchQueries({ include: [GET_INVENTORY_LOCATIONS] })
        onOpenChange(false)
      },
      onError: (err) =>
        sileo.error({ title: err.message || t("locationForm.updateFailed") }),
    }
  )

  const busy = creating || updating

  function onSubmit() {
    if (!name.trim()) {
      sileo.error({ title: t("locationForm.nameRequired") })
      return
    }
    const payload = {
      name: name.trim(),
      address_line1: addressLine1.trim() || null,
      city: city.trim() || null,
      country: country.trim() || null,
      phone: phone.trim() || null,
      national_address_code: nationalAddress.trim() || null,
      is_active: isActive,
      fulfills_online_orders: fulfillsOnline,
    }
    if (mode === "create") {
      void createMutation({ variables: { input: payload } })
    } else if (location) {
      void updateMutation({
        variables: { input: { id: location.id, ...payload } },
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? t("locations.add")
              : t("locationForm.editTitle")}
          </DialogTitle>
          <DialogDescription>{t("locationForm.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="loc-name">
              {t("locationForm.nameLabel")}
            </FieldLabel>
            <Input
              id="loc-name"
              placeholder={t("locationForm.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="loc-addr">
              {t("locationForm.address")}
            </FieldLabel>
            <Input
              id="loc-addr"
              placeholder={t("locationForm.addressPlaceholder")}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="loc-city">
                {t("locationForm.city")}
              </FieldLabel>
              <Input
                id="loc-city"
                placeholder={t("locationForm.cityPlaceholder")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="loc-country">
                {t("locationForm.country")}
              </FieldLabel>
              <Input
                id="loc-country"
                placeholder="SA"
                maxLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="loc-phone">
              {t("locationForm.phone")}
            </FieldLabel>
            <Input
              id="loc-phone"
              placeholder="+966 11 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          {/*
            Sits under Phone because the two travel together: the carrier
            needs an address a driver can find AND someone to call on arrival,
            and registering a pickup location refuses without both.
          */}
          <NationalAddressField
            value={nationalAddress}
            onChange={setNationalAddress}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <label className="flex cursor-pointer items-center justify-between text-sm">
              <div>
                <div className="font-medium">{t("locationForm.active")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("locationForm.activeHint")}
                </div>
              </div>
              <AppleSwitch
                checked={isActive}
                onCheckedChange={(v) => setIsActive(!!v)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between text-sm">
              <div>
                <div className="font-medium">
                  {t("locationForm.fulfillsOnline")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("locationForm.fulfillsOnlineHint")}
                </div>
              </div>
              <AppleSwitch
                checked={fulfillsOnline}
                onCheckedChange={(v) => setFulfillsOnline(!!v)}
              />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {tCommon("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={busy || !name.trim()}>
            {busy
              ? t("locationForm.saving")
              : mode === "create"
                ? t("locationForm.create")
                : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
