"use client"

import { Controller } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { FieldError } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import { CheckboxRow } from "../ui/checkbox-row"

export function MaximumUsesCard({ form }: { form: CouponFormApi }) {
  const t = useTranslations("coupons.maximumUses")
  const {
    register,
    control,
    formState: { errors },
  } = form

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Controller
          control={control}
          name="limit_uses"
          render={({ field }) => (
            <CheckboxRow
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              label={t("limitTotal")}
            >
              {field.value ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    placeholder={t("placeholder")}
                    {...register("max_uses")}
                  />
                  <FieldError errors={[errors.max_uses]} />
                </>
              ) : null}
            </CheckboxRow>
          )}
        />

        <Controller
          control={control}
          name="limit_one_per_customer"
          render={({ field }) => (
            <CheckboxRow
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              label={t("oncePerCustomer")}
            />
          )}
        />
      </CardContent>
    </Card>
  )
}
