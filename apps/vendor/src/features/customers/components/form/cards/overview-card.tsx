"use client"

import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { customerLanguageOptions } from "@/features/customers/lib/constants"
import type { CustomerFormApi } from "../customer-form-layout"

/**
 * First card on the customer form — name, email, phone, language, and
 * marketing consent. Mirrors Shopify's "Customer overview" block.
 */
export function OverviewCard({ form }: { form: CustomerFormApi }) {
  const t = useTranslations("customers")
  const {
    register,
    control,
    formState: { errors },
  } = form
  // Handed to the root as `items` so the trigger names the language rather
  // than showing its code.
  const languageOptions = customerLanguageOptions(t)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="customer-first-name">
              {t("overview.firstName")}
            </FieldLabel>
            <Input
              id="customer-first-name"
              autoComplete="given-name"
              aria-invalid={!!errors.first_name || undefined}
              {...register("first_name")}
            />
            {errors.first_name?.message && (
              <FieldError errors={[{ message: errors.first_name.message }]} />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="customer-last-name">
              {t("overview.lastName")}
            </FieldLabel>
            <Input
              id="customer-last-name"
              autoComplete="family-name"
              {...register("last_name")}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="customer-language">
            {t("overview.language")}
          </FieldLabel>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select
                items={languageOptions}
                value={field.value || "en"}
                onValueChange={(v) => field.onChange(v)}
              >
                <SelectTrigger id="customer-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t("overview.languageHint")}
          </p>
        </Field>

        <Field>
          <FieldLabel htmlFor="customer-email">{t("overview.email")}</FieldLabel>
          <Input
            id="customer-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email || undefined}
            {...register("email")}
          />
          {errors.email?.message && (
            <FieldError errors={[{ message: errors.email.message }]} />
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="customer-phone">{t("overview.phone")}</FieldLabel>
          <Input
            id="customer-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+966501234567"
            {...register("phone_number")}
          />
        </Field>

        <div className="flex flex-col gap-3">
          <Controller
            control={control}
            name="accepts_marketing"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-0.5"
                />
                <span>{t("overview.acceptsMarketing")}</span>
              </label>
            )}
          />
          <Controller
            control={control}
            name="accepts_sms_marketing"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-0.5"
                />
                <span>{t("overview.acceptsSms")}</span>
              </label>
            )}
          />
        </div>

        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          {t("overview.consentHint")}
        </p>
      </CardContent>
    </Card>
  )
}
