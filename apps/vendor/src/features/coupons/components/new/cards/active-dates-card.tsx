"use client"

import { useMemo } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import { detectTimezone } from "@/features/coupons/validations/coupon"
import { CheckboxRow } from "../ui/checkbox-row"
import { DateField } from "../ui/date-field"

// Short list of common IANA zones for the merchant's quick-pick datalist;
// the input still accepts any IANA string so this isn't exhaustive.
const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Amman",
  "Asia/Beirut",
  "Asia/Baghdad",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Istanbul",
  "America/New_York",
  "America/Los_Angeles",
]

export function ActiveDatesCard({ form }: { form: CouponFormApi }) {
  const t = useTranslations("coupons.activeDates")
  const {
    register,
    control,
    formState: { errors },
  } = form

  const browserZone = useMemo(() => detectTimezone(), [])
  const selectedTz = (useWatch({ control, name: "timezone" }) as string | undefined)
    || browserZone

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel>{t("startDate")}</FieldLabel>
            <DateField control={control} name="active_from_date" />
            <FieldError errors={[errors.active_from_date]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="active_from_time">
              {t("startTime", { timezone: selectedTz })}
            </FieldLabel>
            <Input
              id="active_from_time"
              type="time"
              step="1"
              className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              {...register("active_from_time")}
            />
            <FieldError errors={[errors.active_from_time]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="timezone">{t("timezone")}</FieldLabel>
          <Input
            id="timezone"
            list="timezone-suggestions"
            placeholder={browserZone}
            {...register("timezone")}
          />
          <datalist id="timezone-suggestions">
            {COMMON_TIMEZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </Field>

        <Controller
          control={control}
          name="set_end_date"
          render={({ field }) => (
            <>
              <CheckboxRow
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(v)}
                label={t("setEndDate")}
              />
              {field.value ? (
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("endDate")}</FieldLabel>
                    <DateField control={control} name="expire_at_date" />
                    <FieldError errors={[errors.expire_at_date]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="expire_at_time">
                      {t("endTime", { timezone: selectedTz })}
                    </FieldLabel>
                    <Input
                      id="expire_at_time"
                      type="time"
                      step="1"
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                      {...register("expire_at_time")}
                    />
                  </Field>
                </div>
              ) : null}
            </>
          )}
        />
      </CardContent>
    </Card>
  )
}
