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
import type { FeatureCostRow } from "../types"
import { formatCount } from "../lib/analytics"

/**
 * What the platform paid third-party providers, per metered capability.
 *
 * **This is the number that exists nowhere a vendor can reach it.**
 * `UsageEventEntry.cost_cents` is what we were billed for a call; the vendor's
 * `myUsageEvents` is an explicit pick with the field left out. Against a shop's
 * subscription price it is the margin, which is why it belongs on the admin
 * analytics screen and not on the vendor's.
 *
 * `cost_cents` is integer cents — `formatAmountCents` scales it. The sibling
 * revenue figures on this screen are already major units. Two units, two
 * formatters, no inline arithmetic.
 */
export function ProviderCostCard({
  rows,
  loading,
  windowLabel,
}: {
  rows: readonly FeatureCostRow[]
  loading: boolean
  windowLabel: string
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()

  const totalCost = rows.reduce((sum, row) => sum + row.cost_cents, 0)
  // Ranked by what it cost us, which is the reason to look at this table.
  const ordered = [...rows].sort((a, b) => b.cost_cents - a.cost_cents)

  return (
    <DataTableCard>
      <DataTableToolbar>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t("providerCost.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("providerCost.subtitle", { window: windowLabel })}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {t("providerCost.total", {
            amount: formatAmountCents(totalCost, locale),
          })}
        </span>
      </DataTableToolbar>
      <Bones name="admin-provider-cost" loading={loading}>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("providerCost.column.feature")}</DataTableHead>
            <DataTableHead>{t("providerCost.column.group")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("providerCost.column.events")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("providerCost.column.quantity")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("providerCost.column.cost")}
            </DataTableHead>
          </DataTableHeader>
          <TableBody>
            {ordered.length === 0 ? (
              <DataTableEmpty colSpan={5}>
                {t("providerCost.empty")}
              </DataTableEmpty>
            ) : (
              ordered.map((row) => (
                <DataTableRow key={row.feature_key}>
                  <DataTableCell>
                    <div className="flex flex-col">
                      <span>{row.feature_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.feature_key}
                      </span>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {row.group}
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
