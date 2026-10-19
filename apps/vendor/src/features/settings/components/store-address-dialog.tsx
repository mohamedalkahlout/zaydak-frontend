"use client"

import { useId, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"
import {
  CountrySelect,
  SA_COUNTRY_CODE,
  SaCitySelect,
  SaDistrictSelect,
  SaRegionSelect,
  isValidPostalCode,
  resolveCountry,
} from "@/shared/geo"
import type { GeneralValues } from "../types"

/** The keys this dialog owns; everything else in the form is untouched. */
const ADDRESS_KEYS = [
  "company",
  "formattedAddress",
  "apartment",
  "city",
  "state",
  "district",
  "zip",
  "country",
] as const
type AddressKey = (typeof ADDRESS_KEYS)[number]
type AddressDraft = Pick<GeneralValues, AddressKey>

function pickAddress(v: GeneralValues): AddressDraft {
  return {
    company: v.company,
    formattedAddress: v.formattedAddress,
    apartment: v.apartment,
    city: v.city,
    state: v.state,
    district: v.district,
    zip: v.zip,
    country: v.country,
  }
}

/**
 * Shopify's "Edit store address" dialog, over the same staged form the General
 * pane is holding.
 *
 * It does **not** save. Every field writes straight into the form as it is
 * typed, which is what raises the contextual save bar in the navbar; the
 * footer's Done only closes, and Cancel puts back the snapshot taken when the
 * dialog opened. That is the popover-editor rule in `AGENTS.md` — one Save in
 * the app, and it is the bar.
 *
 * Country is editable here, unlike Shopify's (which sends you to a business
 * entity screen we have no equivalent of). Choosing Saudi Arabia swaps the
 * region and city text inputs for pickers over the official SPL tables; every
 * other country keeps free text, because a dropdown covering 249 countries
 * badly is worse than a field the vendor can just fill in.
 */
export function StoreAddressDialog({
  form,
  open,
  onOpenChange,
}: {
  form: UseFormReturn<GeneralValues>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.general")
  const tCommon = useTranslations("common")
  const { register, setValue, watch } = form

  const country = watch("country")
  const state = watch("state")
  const city = watch("city")
  const district = watch("district")
  const zip = watch("zip")
  const resolved = resolveCountry(country)
  const isSaudi = resolved?.code === SA_COUNTRY_CODE

  // Advisory: 61 of 250 countries have no pattern at all, so a mismatch is
  // flagged and never blocks. Done still closes and the save bar still saves —
  // refusing an address because our table is thin is the worse failure.
  const postalOk = isValidPostalCode(country, zip)

  // Snapshot the address the dialog opened on, so Cancel can put it back.
  // Adjusted during render rather than in an effect (React Compiler's
  // `set-state-in-effect`) — React throws this render away and re-runs it.
  const [openedWith, setOpenedWith] = useState<AddressDraft | null>(null)
  const [seededOpen, setSeededOpen] = useState(false)
  if (open !== seededOpen) {
    setSeededOpen(open)
    setOpenedWith(open ? pickAddress(form.getValues()) : null)
  }

  const stage = (key: AddressKey, value: string) =>
    setValue(key, value, { shouldDirty: true })

  const cancel = () => {
    if (openedWith) {
      for (const key of ADDRESS_KEYS) {
        setValue(key, openedWith[key], { shouldDirty: true })
      }
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editAddress")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{t("addressVisible")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("companyName")} className="sm:col-span-2">
            {(id) => (
              <Input aria-labelledby={id} {...register("company")} />
            )}
          </Field>

          <Field label={t("country")} className="sm:col-span-2">
            {(id) => (
              <CountrySelect
                value={country}
                labelId={id}
                onChange={(code) => {
                  stage("country", code)
                  // A region and a city only mean anything inside the country
                  // they were picked in — carrying "Riyadh" into Germany would
                  // quietly ship an address that does not exist.
                  if (code !== resolved?.code) {
                    stage("state", "")
                    stage("city", "")
                    stage("district", "")
                  }
                }}
              />
            )}
          </Field>

          <Field label={t("address")} className="sm:col-span-2">
            {(id) => (
              <Input
                aria-labelledby={id}
                {...register("formattedAddress")}
                placeholder={t("addressPlaceholder")}
              />
            )}
          </Field>

          <Field label={t("apartment")} className="sm:col-span-2">
            {(id) => <Input aria-labelledby={id} {...register("apartment")} />}
          </Field>

          <Field label={t("stateRegion")}>
            {(id) =>
              isSaudi ? (
                <SaRegionSelect
                  value={state}
                  labelId={id}
                  onChange={(regionEn) => {
                    stage("state", regionEn)
                    // The city list is scoped to the region, so a city from the
                    // previous one would no longer be offered — and would sit
                    // in the field looking chosen. The district, the same.
                    stage("city", "")
                    stage("district", "")
                  }}
                />
              ) : (
                <Input aria-labelledby={id} {...register("state")} />
              )
            }
          </Field>

          <Field label={t("city")}>
            {(id) =>
              isSaudi ? (
                <SaCitySelect
                  regionEn={state}
                  value={city}
                  labelId={id}
                  onChange={(cityEn) => {
                    stage("city", cityEn)
                    stage("district", "")
                  }}
                />
              ) : (
                <Input aria-labelledby={id} {...register("city")} />
              )
            }
          </Field>

          {/* Saudi only: a district is what a Saudi carrier keys an address
              on, and no other country here has a table to pick it from. */}
          {isSaudi && (
            <Field label={t("district")}>
              {(id) => (
                <SaDistrictSelect
                  regionEn={state}
                  cityEn={city}
                  value={district}
                  labelId={id}
                  onChange={(districtEn) => stage("district", districtEn)}
                />
              )}
            </Field>
          )}

          <Field label={t("zip")}>
            {(id) => (
              <>
                <Input
                  aria-labelledby={id}
                  aria-invalid={!postalOk || undefined}
                  dir="ltr"
                  {...register("zip")}
                  className={cn(
                    !postalOk &&
                      "border-destructive focus-visible:border-destructive",
                  )}
                />
                {!postalOk && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                    {resolved?.postalFormat
                      ? t("postalFormatHint", {
                          format: resolved.postalFormat,
                        })
                      : t("postalUnexpected")}
                  </p>
                )}
              </>
            )}
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={cancel}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {tCommon("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A label above its control. The child is a function handed the label's id
 * because half these controls are buttons, not inputs: a `<label htmlFor>`
 * does nothing for a combobox, so both kinds point `aria-labelledby` at the
 * same span instead. The id comes from `useId`, not from the label text —
 * the Arabic labels reduce to the same slug under any ASCII-only rule.
 */
function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: (labelId: string) => React.ReactNode
}) {
  const labelId = useId()
  return (
    <div className={className}>
      <span id={labelId} className="mb-1.5 block text-sm font-medium">
        {label}
      </span>
      {children(labelId)}
    </div>
  )
}
