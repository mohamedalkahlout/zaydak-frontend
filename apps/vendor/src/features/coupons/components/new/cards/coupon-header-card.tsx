"use client"

import { Controller, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import { MethodToggle } from "../ui/method-toggle"

/**
 * First card on every coupon form: title + method toggle (code/automatic) +
 * the code (or automatic-discount title) input. Mirrors Shopify's "Create
 * discount" header card.
 */
export function CouponHeaderCard({
  form,
  title,
}: {
  form: CouponFormApi
  /** Already localized — the coupon kind's label. */
  title: string
}) {
  const t = useTranslations("coupons.headerCard")
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form

  const method = useWatch({ control, name: "method" })

  const generateCode = () => {
    const code = `SAVE${Math.floor(10000 + Math.random() * 90000)}`
    setValue("code", code, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel>{t("method")}</FieldLabel>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <div className="inline-flex w-fit rounded-lg border bg-background p-0.5">
                <MethodToggle
                  active={(field.value ?? "code") === "code"}
                  onClick={() => field.onChange("code")}
                >
                  {t("discountCode")}
                </MethodToggle>
                <MethodToggle
                  active={field.value === "automatic"}
                  onClick={() => field.onChange("automatic")}
                >
                  {t("automaticDiscount")}
                </MethodToggle>
              </div>
            )}
          />
        </Field>

        {method === "automatic" ? (
          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            {t("automaticHint")}
          </div>
        ) : (
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="code">{t("discountCode")}</FieldLabel>
              <button
                type="button"
                onClick={generateCode}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("generateCode")}
              </button>
            </div>
            <Input
              id="code"
              autoCapitalize="characters"
              className="font-mono uppercase"
              {...register("code")}
            />
            <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
            <FieldError errors={[errors.code]} />
          </Field>
        )}
      </CardContent>
    </Card>
  )
}
