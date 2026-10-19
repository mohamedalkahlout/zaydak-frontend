"use client"

import { Controller, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import { CheckboxRow } from "../ui/checkbox-row"

export function CombinationsCard({ form }: { form: CouponFormApi }) {
  const t = useTranslations("coupons.combinations")
  const { control } = form
  const exclusive = !!useWatch({ control, name: "is_exclusive" })
  const allowProduct = !!useWatch({ control, name: "allow_product" })
  const allowOrder = !!useWatch({ control, name: "allow_order" })
  const allowShipping = !!useWatch({ control, name: "allow_shipping" })
  const noneChecked =
    !exclusive && !allowProduct && !allowOrder && !allowShipping

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Controller
          control={control}
          name="allow_product"
          render={({ field }) => (
            <CheckboxRow
              checked={!exclusive && !!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              disabled={exclusive}
              label={t("productDiscounts")}
              helper={t("productDiscountsHint")}
            />
          )}
        />
        <Controller
          control={control}
          name="allow_order"
          render={({ field }) => (
            <CheckboxRow
              checked={!exclusive && !!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              disabled={exclusive}
              label={t("orderDiscounts")}
              helper={t("orderDiscountsHint")}
            />
          )}
        />
        <Controller
          control={control}
          name="allow_shipping"
          render={({ field }) => (
            <CheckboxRow
              checked={!exclusive && !!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              disabled={exclusive}
              label={t("shippingDiscounts")}
              helper={t("shippingDiscountsHint")}
            />
          )}
        />
        <Controller
          control={control}
          name="is_exclusive"
          render={({ field }) => (
            <CheckboxRow
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              label={t("exclusive")}
            />
          )}
        />

        {(exclusive || noneChecked) && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {t("exclusiveNote")}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
