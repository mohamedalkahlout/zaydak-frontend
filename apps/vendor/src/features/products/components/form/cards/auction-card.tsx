"use client"

import { useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { MoneySuffix } from "@/shared/components/money-suffix"
import type { ProductFormApi } from "@/features/products/validations/product"

/**
 * Auction-only pricing fields. Bid amounts are entered in major units and
 * converted to integer cents on submit (PRODUCTS.md §3); `max_percentage`
 * is expressed as a whole-number percent (15 = 15.00%) and stored as
 * basis points server-side (1 bp = 0.01%, 10000 = 100%).
 */
export function AuctionCard({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.auctionCard")
  const {
    register,
    control,
    formState: { errors },
  } = form
  const saleType = useWatch({ control, name: "sale_type" }) ?? "FIXED_PRICE"
  if (saleType !== "AUCTION") return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="min_bid_price">{t("minBid")}</FieldLabel>
            <div className="relative">
              <Input
                id="min_bid_price"
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                className="pe-12"
                {...register("min_bid_price")}
              />
              <MoneySuffix />
            </div>
            <FieldError errors={[errors.min_bid_price]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="max_bid_price">{t("maxBid")}</FieldLabel>
            <div className="relative">
              <Input
                id="max_bid_price"
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                className="pe-12"
                {...register("max_bid_price")}
              />
              <MoneySuffix />
            </div>
            <FieldError errors={[errors.max_bid_price]} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="max_percentage">{t("maxIncrement")}</FieldLabel>
          <div className="relative sm:max-w-[200px]">
            <Input
              id="max_percentage"
              type="number"
              step="0.01"
              min={0}
              max={100}
              placeholder="0"
              className="pr-8"
              {...register("max_percentage")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
              %
            </span>
          </div>
          <FieldError errors={[errors.max_percentage]} />
        </Field>
      </CardContent>
    </Card>
  )
}
