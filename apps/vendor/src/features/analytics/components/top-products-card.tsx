"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { formatMoneyCents, translatable } from "@/shared/lib/format"
import { Bones } from "@/shared/components/bones"
import type { TopProduct } from "../types"
import { EmptyRow } from "./card-states"

export function TopProductsCard({
  products,
  loading,
  currency = "SAR",
}: {
  products?: TopProduct[]
  loading?: boolean
  currency?: string
}) {
  const t = useTranslations("analytics")

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("topProducts.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bones
          name="analytics-top-products"
          loading={Boolean(loading) && !products}
        >
          <div className="flex flex-col gap-0.5">
            {!products?.length ? (
              <EmptyRow label={t("empty")} />
            ) : (
              products.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="truncate">{translatable(product.name)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">
                      {t("topProducts.ordersCount", {
                        count: product.orders_count,
                      })}
                    </span>
                    <span className="font-medium">
                      {formatMoneyCents(product.total_sales_cents, currency)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </Bones>
      </CardContent>
    </Card>
  )
}
