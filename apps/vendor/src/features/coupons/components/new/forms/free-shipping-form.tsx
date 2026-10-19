"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useVendorAgentHandoff } from "@/features/ai/lib/use-prefill"
import { useCouponLiveForm } from "@/features/coupons/lib/live-form"
import { GlobeIcon, TruckIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { MoneySuffix } from "@/shared/components/money-suffix"
import { Label } from "@repo/ui/components/label"
import {
  freeShippingCouponSchema,
  type CouponFormApi,
  type FreeShippingCouponInput,
  type FreeShippingCouponOutput,
} from "@/features/coupons/validations/coupon"
import { CouponBaseFields } from "../coupon-base-fields"
import { CouponFormLayout } from "../coupon-form-layout"
import { CouponHeaderCard } from "../cards/coupon-header-card"
import {
  CountriesPickerDialog,
  countryLabel,
} from "../countries-picker-dialog"
import { SectionCard } from "../ui/section-card"
import { SegmentedToggle } from "../ui/segmented-toggle"
import { useCouponSubmit } from "../use-coupon-submit"
import { baseCouponDefaults } from "@/features/coupons/lib/new/form-defaults"
import type { InitialCouponSnapshots } from "@/features/coupons/lib/new/from-coupon-entry"
import { formatList } from "@/features/coupons/lib/format-list"
import type { Translate } from "@/shared/i18n/translator"

interface Props {
  mode?: "create" | "edit"
  couponId?: string
  initialValues?: FreeShippingCouponInput
  initialSnapshots?: InitialCouponSnapshots
  headerAction?: React.ReactNode
}

export function FreeShippingCouponForm({
  mode = "create",
  couponId,
  initialValues,
  initialSnapshots,
  headerAction,
}: Props = {}) {
  const locale = useLocale()
  const t = useTranslations("coupons")
  const tv = useTranslations("coupons.validation")
  const tCommon = useTranslations("common")
  const handoff = useVendorAgentHandoff(
    mode === "edit" ? "coupon_edit" : "coupon_create",
    couponId,
  )
  const aiPrefill = handoff?.values
  const mergedDefaults = useMemo(() => {
    const base =
      initialValues ??
      ({
        ...baseCouponDefaults(),
        type: "free_shipping",
        amount: 0,
        allow_product: true,
        allow_order: true,
        countries_mode: "all",
        exclude_shipping_rates: false,
      } satisfies DefaultValues<FreeShippingCouponInput>)
    return aiPrefill
      ? { ...base, ...(aiPrefill as Partial<FreeShippingCouponInput>) }
      : base
  }, [initialValues, aiPrefill])

  const form = useForm<
    FreeShippingCouponInput,
    unknown,
    FreeShippingCouponOutput
  >({
    resolver: zodResolver(freeShippingCouponSchema(tv)),
    defaultValues: mergedDefaults,
  })
  const sharedForm = form as unknown as CouponFormApi
  // While this form is one the assistant prepared it is the live form: each
  // chat message carries its values, and a `patch_form` result is staged
  // into it — dirty, save bar showing, nothing saved until Save.
  useCouponLiveForm({
    form: sharedForm,
    handoffId: handoff?.handoffId,
    mode,
    couponId,
    label: initialValues?.code,
  })
  const { submit, onInvalid, loading } = useCouponSubmit(
    mode === "edit" && couponId
      ? { kind: "edit", id: couponId }
      : { kind: "create" },
    sharedForm,
  )
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form

  const countriesMode = useWatch({ control, name: "countries_mode" }) ?? "all"
  const countries = useWatch({ control, name: "countries" }) ?? []
  const excludeRates = !!useWatch({ control, name: "exclude_shipping_rates" })
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)

  return (
    <CouponFormLayout
      title={
        mode === "edit"
          ? t("freeShippingForm.editTitle")
          : t("kinds.free_shipping.label")
      }
      subtitle={t("freeShippingForm.subtitle")}
      saving={loading}
      form={sharedForm}
      onValid={submit}
      onInvalid={onInvalid}
      typeLabel={t("kinds.free_shipping.label")}
      typeSubLabel={t("form.shippingDiscount")}
      TypeIcon={TruckIcon}
      unsavedLabel={
        mode === "edit" ? t("form.unsavedChanges") : t("form.unsavedDiscount")
      }
      headerAction={headerAction}
      extraDetails={[
        countriesMode === "selected"
          ? t("freeShippingForm.forSelectedCountries")
          : t("freeShippingForm.forAllCountries"),
      ]}
    >
      <CouponHeaderCard
        form={sharedForm}
        title={t("kinds.free_shipping.label")}
      />

      <SectionCard
        icon={GlobeIcon}
        tone="sky"
        title={t("freeShippingForm.countries")}
        subtitle={t("freeShippingForm.countriesHint")}
      >
        <SegmentedToggle
          ariaLabel={t("freeShippingForm.countryScope")}
          value={countriesMode}
          onChange={(next) =>
            setValue("countries_mode", next, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          options={[
            { value: "all", label: t("freeShippingForm.allCountries") },
            {
              value: "selected",
              label: t("freeShippingForm.selectedCountries"),
            },
          ]}
        />

        {countriesMode === "selected" && (
          <Field>
            <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {countries.length === 0
                    ? t("freeShippingForm.noCountries")
                    : t("counts.countries", { count: countries.length })}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {countries.length === 0
                    ? t("freeShippingForm.pickCountriesHint")
                    : countriesPreview(countries, locale, t)}
                </p>
              </div>
              {countries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() =>
                    setValue("countries", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  {tCommon("clear")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-3"
                onClick={() => setCountryPickerOpen(true)}
              >
                {countries.length === 0 ? t("form.browse") : tCommon("edit")}
              </Button>
            </div>
            <FieldError errors={[errors.countries]} />
          </Field>
        )}
      </SectionCard>

      <CountriesPickerDialog
        open={countryPickerOpen}
        onOpenChange={setCountryPickerOpen}
        value={countries}
        onConfirm={(codes) =>
          setValue("countries", codes, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />

      <SectionCard
        icon={TruckIcon}
        tone="amber"
        title={t("freeShippingForm.shippingRates")}
        subtitle={t("freeShippingForm.shippingRatesHint")}
      >
        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="exclude_shipping_rates"
            render={({ field }) => (
              <Checkbox
                id="exclude_shipping_rates"
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(!!v)}
                className="mt-0.5"
              />
            )}
          />
          <div className="flex flex-1 flex-col gap-0.5">
            <Label
              htmlFor="exclude_shipping_rates"
              className="text-sm font-medium leading-snug"
            >
              {t("freeShippingForm.excludeRates")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("freeShippingForm.excludeRatesHint")}
            </p>
          </div>
        </div>
        {excludeRates && (
          <Field className="max-w-xs">
            <FieldLabel htmlFor="exclude_shipping_rates_over">
              {t("freeShippingForm.maxShippingRate")}
            </FieldLabel>
            <div className="relative">
              <Input
                id="exclude_shipping_rates_over"
                type="number"
                step="0.01"
                min={0}
                placeholder="100"
                className="pe-12"
                {...register("exclude_shipping_rates_over")}
              />
              <MoneySuffix />
            </div>
            <FieldError errors={[errors.exclude_shipping_rates_over]} />
          </Field>
        )}
      </SectionCard>

      <CouponBaseFields form={sharedForm} snapshots={initialSnapshots} />
    </CouponFormLayout>
  )
}

/**
 * The first three picked countries by name, and how many more — "Saudi
 * Arabia, Egypt, Jordan +2 more". `t` is the `coupons` translator.
 */
function countriesPreview(
  codes: string[],
  locale: string,
  t: Translate,
): string {
  const names = formatList(
    codes.slice(0, 3).map((code) => countryLabel(code, locale)),
    locale,
  )
  return codes.length > 3
    ? t("form.namesAndMore", { names, count: codes.length - 3 })
    : names
}
