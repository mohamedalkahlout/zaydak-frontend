"use client"

import { useLocale, useTranslations } from "next-intl"
import { Table, TableBody } from "@repo/ui/components/table"
import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { Bones } from "@/shared/components/bones"
import type { TopProductRow } from "../types"
import { formatCount, translatedName } from "../lib/analytics"
import { formatAmountCents } from "@/shared/lib/format"

/**
 * Best sellers across every store, ranked by sales value.
 *
 * Requested with `by: SALES` rather than the resolver's `ORDERS` default: at
 * platform scale a cheap high-volume item outranks everything on order count,
 * which says little about where the GMV is.
 *
 * `total_sales_cents` is integer cents, the same unit as the `cost_cents` on
 * the two cost tables, so it renders through the console-wide
 * `formatAmountCents`. `name` is the `JSON`
 * `{ en, ar }` scalar, so it renders through `translatedName` with the active
 * locale preferred.
 */
export function TopProductsCard({
  rows,
  loading,
}: {
  rows: readonly TopProductRow[]
  loading: boolean
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()

  return (
    <DataTableCard>
      <DataTableToolbar>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t("topProducts.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("topProducts.subtitle")}
          </p>
        </div>
      </DataTableToolbar>
      <Bones name="admin-top-products" loading={loading}>
        <Table>
          <DataTableHeader>
            <DataTableHead className="w-10 text-end">#</DataTableHead>
            <DataTableHead>{t("topProducts.column.product")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("topProducts.column.orders")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("topProducts.column.sales")}
            </DataTableHead>
          </DataTableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <DataTableEmpty colSpan={4}>
                {t("topProducts.empty")}
              </DataTableEmpty>
            ) : (
              rows.map((row, index) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="text-end text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-col">
                      <span>{translatedName(row.name, locale)}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.slug}
                      </span>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatCount(row.orders_count, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end font-medium tabular-nums">
                    {formatAmountCents(row.total_sales_cents, locale)}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Bones>
    </DataTableCard>
  )
}
