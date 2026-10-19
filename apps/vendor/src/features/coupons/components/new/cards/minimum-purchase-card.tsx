"use client"

import { Controller } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { FieldError } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { RadioGroup } from "@repo/ui/components/radio-group"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import { RadioRow } from "../ui/radio-row"

export function MinimumPurchaseCard({ form }: { form: CouponFormApi }) {
  const t = useTranslations("coupons.minimumPurchase")
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
          name="minimum_mode"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? "none"}
              onValueChange={field.onChange}
            >
              <RadioRow
                value="none"
                label={t("none")}
                selected={(field.value ?? "none") === "none"}
              />
              <RadioRow
                value="amount"
                label={t("amount")}
                selected={field.value === "amount"}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  disabled={field.value !== "amount"}
                  {...register("minimum_cart_amount")}
                />
                <FieldError errors={[errors.minimum_cart_amount]} />
              </RadioRow>
              <RadioRow
                value="quantity"
                label={t("quantity")}
                selected={field.value === "quantity"}
              >
                <Input
                  type="number"
                  min={1}
                  step="1"
                  placeholder="0"
                  disabled={field.value !== "quantity"}
                  {...register("minimum_quantity")}
                />
                <FieldError errors={[errors.minimum_quantity]} />
              </RadioRow>
            </RadioGroup>
          )}
        />
      </CardContent>
    </Card>
  )
}
