"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { cn } from "@/shared/lib/utils"
import { translatable } from "@/shared/lib/format"
import { Bones } from "@/shared/components/bones"
import type { LowStockProduct } from "../types"
import { EmptyRow } from "./card-states"

export function LowStockCard({
  products,
  loading,
}: {
  products?: LowStockProduct[]
  loading?: boolean
}) {
  const t = useTranslations("analytics")

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("lowStock.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bones name="analytics-low-stock" loading={Boolean(loading) && !products}>
          <div className="flex flex-col gap-0.5">
            {!products?.length ? (
              <EmptyRow label={t("lowStock.empty")} />
            ) : (
              products.slice(0, 8).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm"
                >
                  <span className="truncate">{translatable(product.name)}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                      product.quantity <= 3
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {t("lowStock.left", { count: product.quantity })}
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
