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
import { formatAmountCents } from "@/shared/lib/format"
import type { AiSpendByPlanRow } from "../types"
import { formatCount } from "../lib/analytics"

/**
 * AI provider spend rolled up by plan tier — which subscriptions cost us.
 */
export function AiSpendByPlanCard({
  rows,
  loading,
  windowLabel,
}: {
  rows: readonly AiSpendByPlanRow[]
  loading: boolean
  windowLabel: string
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()

  return (
    <DataTableCard>
      <DataTableToolbar>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t("aiSpendByPlan.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("aiSpendByPlan.subtitle", { window: windowLabel })}
          </p>
        </div>
      </DataTableToolbar>
      <Bones name="admin-ai-spend-by-plan" loading={loading}>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("aiSpendByPlan.column.plan")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("aiSpendByPlan.column.shops")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("aiSpend.column.sidekick")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("aiSpend.column.customerBot")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("aiSpend.column.images")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("aiSpend.column.other")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("aiSpend.column.total")}
            </DataTableHead>
          </DataTableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <DataTableEmpty colSpan={7}>
                {t("aiSpendByPlan.empty")}
              </DataTableEmpty>
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.plan_id ?? "none"}>
                  <DataTableCell>
                    <span className="flex flex-col">
                      <span>
                        {row.plan_name ?? t("aiSpend.noPlan")}
                      </span>
                      {row.plan_code ? (
                        <span className="text-xs text-muted-foreground">
                          {row.plan_code}
                        </span>
                      ) : null}
                    </span>
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatCount(row.shop_count, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatAmountCents(row.sidekick_cents, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatAmountCents(row.customer_bot_cents, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatAmountCents(row.images_cents, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatAmountCents(row.other_cents, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end font-medium tabular-nums">
                    {formatAmountCents(row.total_cents, locale)}
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
