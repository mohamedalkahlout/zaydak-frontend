"use client"

import Link from "next/link"
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
import { formatAmountCents } from "@/shared/lib/format"
import type { ShopCostRow } from "../types"
import { formatCount } from "../lib/analytics"

/**
 * Which stores are spending our provider budget, ranked.
 *
 * The back-end resolver calls this "the platform's spend, ranked" — it is the
 * screen that answers "who is costing us money", which no per-shop page can.
 * Each row links to that shop's usage ledger under `/subscribers`, so an
 * outlier here is one click from the individual events that produced it.
 *
 * The server already returns these ordered; no client-side sort is applied so
 * the ranking shown is the ranking the server computed over the same window.
 */
export function TopShopsCostCard({
  rows,
  loading,
  windowLabel,
}: {
  rows: readonly ShopCostRow[]
  loading: boolean
  windowLabel: string
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()

  return (
    <DataTableCard>
      <DataTableToolbar>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t("topShops.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("topShops.subtitle", { window: windowLabel })}
          </p>
        </div>
      </DataTableToolbar>
      <Bones name="admin-top-shops-cost" loading={loading}>
        <Table>
          <DataTableHeader>
            <DataTableHead className="w-10 text-end">#</DataTableHead>
            <DataTableHead>{t("topShops.column.shop")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("topShops.column.events")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("topShops.column.quantity")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("topShops.column.cost")}
            </DataTableHead>
          </DataTableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <DataTableEmpty colSpan={5}>{t("topShops.empty")}</DataTableEmpty>
            ) : (
              rows.map((row, index) => (
                <DataTableRow key={row.shop_id}>
                  <DataTableCell className="text-end text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/subscribers/${row.shop_id}/usage`}
                      className="flex flex-col hover:underline"
                    >
                      <span>{row.shop_name ?? row.shop_slug}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.shop_slug}
                      </span>
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatCount(row.events, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatCount(row.quantity, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end font-medium tabular-nums">
                    {formatAmountCents(row.cost_cents, locale)}
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
