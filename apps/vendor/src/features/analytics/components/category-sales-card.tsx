"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { translatable } from "@/shared/lib/format"
import { Bones } from "@/shared/components/bones"
import type { CategorySale } from "../types"
import { EmptyRow } from "./card-states"

export function CategorySalesCard({
  categories,
  loading,
}: {
  categories?: CategorySale[]
  loading?: boolean
}) {
  const t = useTranslations("analytics")
  const rows = categories?.slice(0, 8) ?? []
  const max = rows.reduce((m, row) => Math.max(m, row.total_quantity_sold), 0)

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("categorySales.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bones
          name="analytics-category-sales"
          loading={Boolean(loading) && !categories}
        >
          <div className="flex flex-col gap-2.5">
            {!rows.length ? (
              <EmptyRow label={t("empty")} />
            ) : (
              rows.map((category) => {
                const width =
                  max > 0
                    ? Math.max(4, (category.total_quantity_sold / max) * 100)
                    : 0
                return (
                  <div key={category.category_id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-muted-foreground">
                        {translatable(category.name)}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {t("categorySales.sold", {
                          count: category.total_quantity_sold,
                        })}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Bones>
      </CardContent>
    </Card>
  )
}
