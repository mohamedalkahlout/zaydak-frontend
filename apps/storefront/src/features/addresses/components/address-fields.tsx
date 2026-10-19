"use client"

import { memo, useCallback, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"

import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { cn } from "@repo/ui/lib/utils"

import {
  applyNationalAddress,
  clearResolved,
  type Address,
  type ResolvedNationalAddress,
} from "../lib/address"
import { PALESTINE_CITIES, type PalestineCitiesResult } from "../api"
import { NationalAddressField } from "./national-address-field"
import { useShop } from "@/features/shop/shop-context"

/**
 * The address form shared by checkout and the account address book.
 *
 * Saudi shops: National Address code (default) or manual free-text.
 * Palestine / CITY-match shops (`home_country === "PS"`): city picker that
 * writes stable `city_code` for zone matching, plus street.
 */
export const AddressFields = memo(function AddressFields({
  value,
  onChange,
  idPrefix,
  disabled,
  className,
  inputClassName,
}: {
  value: Address
  onChange: (next: Address) => void
  idPrefix: string
  disabled?: boolean
  className?: string
  inputClassName?: string
}) {
  const t = useTranslations("addresses")
  const locale = useLocale()
  const { shop } = useShop()
  const cityCodeMode = (shop?.home_country ?? "").toUpperCase() === "PS"

  const { data: citiesData } = useQuery<PalestineCitiesResult>(PALESTINE_CITIES, {
    skip: !cityCodeMode,
    fetchPolicy: "cache-first",
  })
  const cities = citiesData?.palestineCities?.data ?? []

  const [manualMode, setManualMode] = useState<boolean>(() => {
    if (cityCodeMode) return true
    return (
      !value.national_address_code &&
      Boolean(value.city || value.street_address || value.country)
    )
  })

  const handleCode = useCallback(
    (code: string) => {
      onChange(
        code.trim().toUpperCase() ===
          value.national_address_code.trim().toUpperCase()
          ? { ...value, national_address_code: code }
          : { ...clearResolved(value), national_address_code: code },
      )
    },
    [onChange, value],
  )

  const handleResolve = useCallback(
    (resolved: ResolvedNationalAddress | null) => {
      onChange(
        resolved ? applyNationalAddress(value, resolved) : clearResolved(value),
      )
    },
    [onChange, value],
  )

  const pickCity = useCallback(
    (code: string) => {
      const city = cities.find((c) => c.code === code)
      const label =
        locale.startsWith("ar") ? city?.name_ar : city?.name_en
      onChange({
        ...value,
        country: "PS",
        national_address_code: "",
        city_code: code,
        city: label ?? value.city,
      })
    },
    [cities, locale, onChange, value],
  )

  if (cityCodeMode) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`${idPrefix}-city-code`}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("city")} <span className="text-destructive">*</span>
          </Label>
          <select
            id={`${idPrefix}-city-code`}
            value={value.city_code || ""}
            disabled={disabled}
            aria-invalid={!value.city_code}
            className={cn(
              "h-11 w-full rounded-xl border border-shop-hairline bg-background px-3 text-sm",
              inputClassName,
            )}
            onChange={(e) => pickCity(e.target.value)}
          >
            <option value="">{t("cityCodePlaceholder")}</option>
            {cities.map((city) => (
              <option key={city.code} value={city.code}>
                {locale.startsWith("ar") ? city.name_ar : city.name_en}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`${idPrefix}-street`}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("street")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${idPrefix}-street`}
            value={value.street_address}
            placeholder={t("streetPlaceholder")}
            disabled={disabled}
            className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
            onChange={(e) =>
              onChange({
                ...value,
                country: "PS",
                national_address_code: "",
                street_address: e.target.value,
              })
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-zip`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("zip")}{" "}
              <span className="text-muted-foreground/60">{t("optional")}</span>
            </Label>
            <Input
              id={`${idPrefix}-zip`}
              value={value.zip}
              placeholder={t("zipPlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) =>
                onChange({ ...value, country: "PS", zip: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-phone`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("phone")}{" "}
              <span className="text-muted-foreground/60">{t("optional")}</span>
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              value={value.phone ?? ""}
              placeholder={t("phonePlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) =>
                onChange({ ...value, country: "PS", phone: e.target.value })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  if (manualMode) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex items-center justify-between gap-2 border-b border-shop-hairline pb-2">
          <div>
            <span className="text-xs font-semibold text-foreground">
              {t("manualModeTitle")}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {t("manualModeHint")}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setManualMode(false)
              onChange(clearResolved(value))
            }}
            className="cursor-pointer text-xs font-medium text-shop-accent hover:underline shrink-0"
          >
            {t("nationalModeAction")}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-country`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("country")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-country`}
              value={value.country}
              placeholder={t("countryPlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) =>
                onChange({ ...value, country: e.target.value, city_code: "" })
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-city`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("city")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-city`}
              value={value.city}
              placeholder={t("cityPlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) =>
                onChange({ ...value, city: e.target.value, city_code: "" })
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`${idPrefix}-street`}
            className="text-xs font-medium text-muted-foreground"
          >
            {t("street")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${idPrefix}-street`}
            value={value.street_address}
            placeholder={t("streetPlaceholder")}
            disabled={disabled}
            className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
            onChange={(e) =>
              onChange({ ...value, street_address: e.target.value })
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-state`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("state")}{" "}
              <span className="text-muted-foreground/60">{t("optional")}</span>
            </Label>
            <Input
              id={`${idPrefix}-state`}
              value={value.state}
              placeholder={t("statePlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) => onChange({ ...value, state: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-zip`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("zip")}{" "}
              <span className="text-muted-foreground/60">{t("optional")}</span>
            </Label>
            <Input
              id={`${idPrefix}-zip`}
              value={value.zip}
              placeholder={t("zipPlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) => onChange({ ...value, zip: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${idPrefix}-phone`}
              className="text-xs font-medium text-muted-foreground"
            >
              {t("phone")}{" "}
              <span className="text-muted-foreground/60">{t("optional")}</span>
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              value={value.phone ?? ""}
              placeholder={t("phonePlaceholder")}
              disabled={disabled}
              className={cn("h-11 rounded-xl border-shop-hairline", inputClassName)}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <NationalAddressField
        id={`${idPrefix}-national-address`}
        value={value.national_address_code}
        onChange={handleCode}
        onResolve={handleResolve}
        disabled={disabled}
        inputClassName={inputClassName}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setManualMode(true)
          onChange({
            ...value,
            country: value.country || "SA",
            national_address_code: "",
            city_code: "",
          })
        }}
        className="cursor-pointer self-start text-xs font-medium text-shop-accent hover:underline"
      >
        {t("manualFallbackAction")}
      </button>
    </div>
  )
})
