"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Table, TableBody } from "@repo/ui/components/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
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
import { Button } from "@repo/ui/components/button"
import type { AiSpendByShopRow } from "../types"

const ALL_PLANS = "__all__"

function downloadAiSpendCsv(rows: readonly AiSpendByShopRow[]) {
  const header = [
    "shop_id",
    "shop_slug",
    "shop_name",
    "plan_id",
    "plan_name",
    "sidekick_cents",
    "customer_bot_cents",
    "images_cents",
    "other_cents",
    "total_cents",
  ]
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.shop_id,
        r.shop_slug,
        r.shop_name,
        r.plan_id,
        r.plan_name,
        r.sidekick_cents,
        r.customer_bot_cents,
        r.images_cents,
        r.other_cents,
        r.total_cents,
      ]
        .map(escape)
        .join(","),
    ),
  ]
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ai-spend-by-shop-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * AI provider spend per shop — Sidekick / Customer bot / Images / Other / Total.
 *
 * Sourced from `usage_events.cost_cents` (platform ledger). Langfuse stays the
 * place to open a trace; this table answers "who cost us money, by surface".
 */
export function AiSpendByShopCard({
  rows,
  loading,
  windowLabel,
  plans,
  planId,
  onPlanChange,
}: {
  rows: readonly AiSpendByShopRow[]
  loading: boolean
  windowLabel: string
  plans: readonly { id: string; name: string }[]
  planId: string | null
  onPlanChange: (planId: string | null) => void
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()

  return (
    <DataTableCard>
      <DataTableToolbar>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{t("aiSpend.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("aiSpend.subtitle", { window: windowLabel })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => downloadAiSpendCsv(rows)}
          >
            {t("aiSpend.exportCsv")}
          </Button>
          <Select
            value={planId ?? ALL_PLANS}
            onValueChange={(v) =>
              onPlanChange(!v || v === ALL_PLANS ? null : v)
            }
          >
            <SelectTrigger
              className="w-44"
              aria-label={t("aiSpend.planFilter")}
            >
              <SelectValue placeholder={t("aiSpend.planFilter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PLANS}>{t("aiSpend.allPlans")}</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DataTableToolbar>
      <Bones name="admin-ai-spend-by-shop" loading={loading}>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("aiSpend.column.shop")}</DataTableHead>
            <DataTableHead>{t("aiSpend.column.plan")}</DataTableHead>
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
              <DataTableEmpty colSpan={7}>{t("aiSpend.empty")}</DataTableEmpty>
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.shop_id}>
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
                  <DataTableCell className="text-muted-foreground">
                    {row.plan_name ?? t("aiSpend.noPlan")}
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
