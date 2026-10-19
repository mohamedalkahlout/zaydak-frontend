"use client"

import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { bpsToPercent, translatable } from "@/shared/lib/format"
import { Bones } from "@/shared/components/bones"
import type { SellThroughProduct } from "../types"
import { EmptyRow } from "./card-states"

/**
 * Products ranked by sell-through rate (units sold ÷ units sold + on-hand)
 * for the selected window — the Shopify "Products by sell-through rate" card.
 */
export function SellThroughCard({
  products,
  loading,
}: {
  products?: SellThroughProduct[]
  loading?: boolean
}) {
  const t = useTranslations("analytics")

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("sellThrough.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bones
          name="analytics-sell-through"
          loading={Boolean(loading) && !products}
        >
          <div className="flex flex-col gap-2">
            {!products?.length ? (
              <EmptyRow label={t("empty")} />
            ) : (
              products.map((product) => {
                const pct = bpsToPercent(product.sell_through_bps)
                return (
                  <div key={product.id} className="flex flex-col gap-1 py-0.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">
                        {translatable(product.name)}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {/* Floor, not round — 99.7% with stock left must not read
                            as a 100% sell-out. */}
                        {Math.floor(pct)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {t("sellThrough.soldLeft", {
                          sold: product.sold_units,
                          left: product.on_hand,
                        })}
                      </span>
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
