"use client"

import { useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"
import { Input } from "@repo/ui/components/input"
import { MoneySuffix } from "@/shared/components/money-suffix"
import { formatMoney } from "@/shared/lib/format"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import type { ProductFormApi } from "@/features/products/validations/product"

/**
 * Pricing is only shown for FIXED_PRICE non-VARIABLE products. VARIABLE
 * products derive price from their variations (min_price_cents /
 * max_price_cents are computed server-side); AUCTION uses the bid fields
 * in the auction card; NEGOTIABLE surfaces a chat CTA instead.
 *
 * Cost per item (Phase A) is purely a vendor analytics signal — it never
 * touches storefront pricing or tax math. Margin% is shown live for
 * Shopify parity.
 */
export function PricingCard({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.pricingCard")
  const currency = useShopCurrency()
  const {
    register,
    control,
    formState: { errors },
  } = form
  const productType = useWatch({ control, name: "product_type" }) ?? "SIMPLE"
  const saleType = useWatch({ control, name: "sale_type" }) ?? "FIXED_PRICE"

  // Live margin preview — recomputes whenever price / sale_price / cost change.
  const price = useWatch({ control, name: "price" })
  const salePrice = useWatch({ control, name: "sale_price" })
  const cost = useWatch({ control, name: "cost_per_item" })

  if (productType === "VARIABLE" || saleType !== "FIXED_PRICE") return null

  const sellPrice =
    typeof salePrice === "number" && salePrice > 0
      ? salePrice
      : typeof price === "number"
        ? price
        : null
  const margin =
    sellPrice != null && typeof cost === "number" && sellPrice > 0
      ? Math.round(((sellPrice - cost) / sellPrice) * 100)
      : null
  const profit =
    sellPrice != null && typeof cost === "number"
      ? Math.round((sellPrice - cost) * 100) / 100
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="price">
              {t("price")}
              <AiFilledMark name="price" />
            </FieldLabel>
            <div className="relative">
              <Input
                id="price"
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                className="pe-12"
                {...register("price")}
              />
              <MoneySuffix />
            </div>
            <FieldError errors={[errors.price]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="sale_price">
              {t("compareAtPrice")}
              <AiFilledMark name="sale_price" />
            </FieldLabel>
            <div className="relative">
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                className="pe-12"
                {...register("sale_price")}
              />
              <MoneySuffix />
            </div>
            <FieldError errors={[errors.sale_price]} />
          </Field>
        </div>

        {/* Cost & profit — Shopify-parity. Cost is never shown to customers. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="cost_per_item">
              {t("costPerItem")}
              <AiFilledMark name="cost_per_item" />
            </FieldLabel>
            <div className="relative">
              <Input
                id="cost_per_item"
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                className="pe-12"
                {...register("cost_per_item")}
              />
              <MoneySuffix />
            </div>
            <p className="text-xs text-muted-foreground">{t("costHint")}</p>
            <FieldError errors={[errors.cost_per_item]} />
          </Field>

          <Field>
            <FieldLabel>{t("profit")}</FieldLabel>
            <Input
              readOnly
              tabIndex={-1}
              value={profit == null ? "—" : formatMoney(profit, currency)}
              className="bg-muted/30"
            />
          </Field>

          <Field>
            <FieldLabel>{t("margin")}</FieldLabel>
            <Input
              readOnly
              tabIndex={-1}
              value={margin == null ? "—" : `${margin}%`}
              className="bg-muted/30"
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}
