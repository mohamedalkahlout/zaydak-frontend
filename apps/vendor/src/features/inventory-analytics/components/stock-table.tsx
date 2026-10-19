"use client"

import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { Bones } from "@/shared/components/bones"
import { cn } from "@/shared/lib/utils"
import { bpsToPercent, formatMoneyCents, translatable } from "@/shared/lib/format"
import type { StockRow } from "../types"
import { abcBadgeClass } from "../lib/inventory"

export function StockTable({
  title,
  rows,
  currency,
  loading,
  emptyLabel,
  boneName = "inventory-stock-table",
}: {
  title: string
  rows: StockRow[]
  currency: string
  loading?: boolean
  emptyLabel: string
  /**
   * Which captured table to show while loading. One shape is shared across all
   * three tables on this page by default — they render the same columns and
   * differ only in their rows.
   */
  boneName?: string
}) {
  const t = useTranslations("inventoryAnalytics")

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bones name={boneName} loading={Boolean(loading)}>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col.product")}</TableHead>
                  <TableHead className="text-end">{t("col.qty")}</TableHead>
                  <TableHead className="text-end">{t("col.sold")}</TableHead>
                  <TableHead className="text-end">{t("col.sellThrough")}</TableHead>
                  <TableHead className="text-end">{t("col.doi")}</TableHead>
                  <TableHead className="text-center">{t("col.abc")}</TableHead>
                  <TableHead className="text-end">{t("col.cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{translatable(r.name)}</span>
                        {r.sku ? (
                          <span className="text-xs text-muted-foreground">
                            {r.sku}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {r.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {r.units_sold.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {bpsToPercent(r.sell_through_bps).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {r.days_of_inventory == null
                        ? "—"
                        : t("col.daysValue", { days: r.days_of_inventory })}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.abc_class === "NONE" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded text-xs font-semibold",
                            abcBadgeClass(r.abc_class),
                          )}
                        >
                          {r.abc_class}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatMoneyCents(r.inventory_cost_cents, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </Bones>
      </CardContent>
    </Card>
  )
}
