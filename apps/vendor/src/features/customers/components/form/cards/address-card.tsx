"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Controller, useWatch } from "react-hook-form"
import { ChevronRightIcon, PlusIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { COUNTRY_CODES, countryName } from "@/features/customers/lib/constants"
import { formatAddressLines } from "@/features/customers/lib/helpers"
import type { CustomerFormApi } from "../customer-form-layout"

interface AddressCardProps {
  form: CustomerFormApi
  /** Edit mode opens the address inline by default since most edits touch it. */
  initiallyOpen?: boolean
}

/**
 * "Default address" card — collapsed by default on the create page to
 * match Shopify's empty-address affordance, expandable inline once the
 * merchant clicks Add address (or has any field already populated).
 */
export function AddressCard({ form, initiallyOpen }: AddressCardProps) {
  const t = useTranslations("customers.address")
  const locale = useLocale()
  const { control, register } = form
  const address = useWatch({ control, name: "address" })
  const hasAnyValue = !!(
    address &&
    Object.values(address).some(
      (v) => typeof v === "string" && v.trim() !== "",
    )
  )
  const [open, setOpen] = useState(initiallyOpen || hasAnyValue)
  const preview = formatAddressLines(address ?? null)
  // Handed to the root as `items` so the trigger names the country rather
  // than showing the stored code.
  const countryOptions = COUNTRY_CODES.map((code) => ({
    value: code,
    label: countryName(code, locale),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-3 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <PlusIcon className="size-4" />
              {preview.length > 0 ? preview.join(" · ") : t("add")}
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="address-company">{t("company")}</FieldLabel>
              <Input
                id="address-company"
                autoComplete="organization"
                {...register("address.company")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="address-line-1">{t("line1")}</FieldLabel>
              <Input
                id="address-line-1"
                autoComplete="address-line1"
                {...register("address.address_1")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="address-line-2">{t("line2")}</FieldLabel>
              <Input
                id="address-line-2"
                autoComplete="address-line2"
                {...register("address.address_2")}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="address-city">{t("city")}</FieldLabel>
                <Input
                  id="address-city"
                  autoComplete="address-level2"
                  {...register("address.city")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="address-postal">
                  {t("postalCode")}
                </FieldLabel>
                <Input
                  id="address-postal"
                  autoComplete="postal-code"
                  {...register("address.postal_code")}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="address-region">{t("region")}</FieldLabel>
                <Input
                  id="address-region"
                  autoComplete="address-level1"
                  {...register("address.region")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="address-country">{t("country")}</FieldLabel>
                <Controller
                  control={control}
                  name="address.country"
                  render={({ field }) => (
                    <Select
                      items={countryOptions}
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <SelectTrigger id="address-country" className="w-full">
                        <SelectValue placeholder={t("countryPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {countryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            {hasAnyValue && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    form.setValue(
                      "address",
                      {
                        address_1: "",
                        address_2: "",
                        city: "",
                        region: "",
                        country: "",
                        postal_code: "",
                        company: "",
                      },
                      { shouldDirty: true },
                    )
                  }}
                >
                  {t("clear")}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
