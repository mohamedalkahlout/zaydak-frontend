"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { PencilIcon, PlusIcon } from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Table, TableBody } from "@repo/ui/components/table"

import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeletonRows,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { formatAmountCents, formatBps, formatDate } from "@/shared/lib/format"
import { PAYMENT_GATEWAY_FEES } from "../api"
import { isEditableFee, type PaymentFeeRow } from "../types"
import { PaymentFeeFormDialog } from "./payment-fee-form-dialog"

const COLUMNS = 8

/**
 * The platform's processor-fee schedule: one row per payment method and
 * currency, with what an order paid that way costs the platform.
 *
 * It is not paginated. The list holds one row per method and currency, and the
 * API returns it whole.
 *
 * **The page says what a change does before anything is changed.** A fee here
 * is not one shop's setting: it prices the negotiation margin floor for every
 * shop, and outcome margins and profit figures are worked out from it each time
 * they are read, so a saved rate also moves numbers that were already on
 * somebody's screen yesterday. The notice sits above the table for that reason
 * and is repeated in the form.
 */
export function PaymentFeesTable() {
  const t = useTranslations("paymentFees")
  const locale = useLocale()
  // `null` is closed; `{ fee: null }` is the form for a new fee.
  const [form, setForm] = useState<{ fee: PaymentFeeRow | null } | null>(null)

  const { data, loading, error, refetch } = useQuery(PAYMENT_GATEWAY_FEES)
  const schedule = data?.paymentGatewayFees
  const rows = schedule?.data ?? []
  const gateways = schedule?.gateways ?? []
  const shopOverrides = schedule?.shop_override_count ?? 0

  // A method the catalogue has no name for shows its code, never a blank.
  const methodLabel = (gateway: string) =>
    t.has(`gateway.${gateway}`) ? t(`gateway.${gateway}`) : gateway

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          onClick={() => setForm({ fee: null })}
          disabled={gateways.length === 0}
        >
          <PlusIcon className="size-4" />
          {t("add")}
        </Button>
      </header>

      <aside
        role="note"
        className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
      >
        <h2 className="text-sm font-medium">{t("impact.title")}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t("impact.body")}
        </p>
      </aside>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("loadFailed")}
        </p>
      ) : null}

      <DataTableCard>
        {schedule ? (
          <DataTableToolbar>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("total", { count: rows.length })}
            </p>
            {shopOverrides > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("overrides", { count: shopOverrides })}
              </p>
            ) : null}
          </DataTableToolbar>
        ) : null}

        <Table>
          <DataTableHeader>
            <DataTableHead>{t("column.method")}</DataTableHead>
            <DataTableHead>{t("column.currency")}</DataTableHead>
            <DataTableHead className="text-end">
              {t("column.percent")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("column.fixed")}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t("column.cap")}
            </DataTableHead>
            <DataTableHead>{t("column.status")}</DataTableHead>
            <DataTableHead>{t("column.updated")}</DataTableHead>
            <DataTableHead className="w-24" />
          </DataTableHeader>
          <TableBody>
            {loading && !schedule ? (
              <DataTableSkeletonRows columns={COLUMNS} />
            ) : (
              rows.map((row) => {
                const editable = isEditableFee(row, gateways)
                const method = methodLabel(row.gateway)
                return (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <div className="font-medium">{method}</div>
                      {editable ? null : (
                        <p className="max-w-xs text-xs whitespace-normal text-muted-foreground">
                          {t("notUsed")}
                        </p>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-muted-foreground" dir="ltr">
                      {row.currency}
                    </DataTableCell>
                    <DataTableCell className="text-end font-medium tabular-nums">
                      {t("percent", { value: formatBps(row.fee_bps, locale) })}
                    </DataTableCell>
                    <DataTableCell className="text-end tabular-nums">
                      {formatAmountCents(row.fee_fixed_cents, locale)}
                    </DataTableCell>
                    <DataTableCell className="text-end tabular-nums">
                      {row.fee_cap_cents == null ? (
                        <span className="text-muted-foreground">
                          {t("noCap")}
                        </span>
                      ) : (
                        formatAmountCents(row.fee_cap_cents, locale)
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={row.active ? "secondary" : "outline"}>
                        {row.active ? t("status.active") : t("status.off")}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell className="text-muted-foreground">
                      {formatDate(row.updated_at, locale)}
                    </DataTableCell>
                    <DataTableCell className="text-end">
                      {editable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("editFee", { method })}
                          onClick={() => setForm({ fee: row })}
                        >
                          <PencilIcon className="size-3.5" />
                          {t("edit")}
                        </Button>
                      ) : null}
                    </DataTableCell>
                  </DataTableRow>
                )
              })
            )}

            {schedule && !error && rows.length === 0 ? (
              <DataTableEmpty colSpan={COLUMNS}>{t("empty")}</DataTableEmpty>
            ) : null}
          </TableBody>
        </Table>
      </DataTableCard>

      {form ? (
        <PaymentFeeFormDialog
          fee={form.fee}
          rows={rows}
          gateways={gateways}
          methodLabel={methodLabel}
          onClose={() => setForm(null)}
          onSaved={() => void refetch()}
        />
      ) : null}
    </section>
  )
}
