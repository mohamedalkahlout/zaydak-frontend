"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { Table, TableBody } from "@repo/ui/components/table"
import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeletonRows,
} from "@/shared/components/data-table/data-table"
import { centsToMajor } from "@/shared/lib/format"
import { ADMIN_DELETE_PLAN, ADMIN_PLANS } from "../api"
import { planHref } from "../nav"
import type { PlanRow } from "../types"
import { PlanFormDialog } from "./plan-form-dialog"

/**
 * The plans list.
 *
 * `allPlans` (not `plans`) so the FREE fallback and any bespoke tier are
 * visible — they are real plans an admin has to be able to see, just not ones a
 * vendor can pick.
 *
 * **The capability matrix is no longer expanded inline.** It was an accordion
 * under whichever row had been clicked, which meant the thing an admin actually
 * came here to edit had no URL and pushed the rest of the table off screen.
 * Each plan is a route now; this list only lists.
 */
export function PlansTable() {
  const t = useTranslations("plans")
  const { data, loading, refetch } = useQuery(ADMIN_PLANS)
  const [remove, { loading: removing }] = useMutation(ADMIN_DELETE_PLAN)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plans = data?.allPlans.data ?? []

  async function onDelete(plan: PlanRow) {
    setError(null)
    // Deleting a plan is not reversible from this screen and the server refuses
    // it outright while shops are still subscribed, so confirm and name the plan.
    if (!window.confirm(t("deleteConfirm", { name: plan.name }))) return
    try {
      await remove({ variables: { id: plan.id } })
      await refetch()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>{t("newPlan")}</Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <DataTableCard>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("col.plan")}</DataTableHead>
            <DataTableHead>{t("col.code")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.monthly")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.yearly")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.trial")}</DataTableHead>
            <DataTableHead>{t("col.visibility")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.actions")}</DataTableHead>
          </DataTableHeader>
          <TableBody>
            {loading ? (
              <DataTableSkeletonRows columns={7} rows={4} />
            ) : (
              plans.map((plan) => (
                <DataTableRow key={plan.id}>
                  <DataTableCell className="font-medium">
                    {/* The name is the way in — a row that opens its own screen
                        should say so, not hide behind a button at the far end. */}
                    <Link
                      href={planHref(plan.id)}
                      className="hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {plan.name}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {plan.code}
                    </code>
                  </DataTableCell>
                  {/* Cents in, major units on screen — converted here, at the
                      network boundary, never inside a render loop elsewhere. */}
                  <DataTableCell className="text-end tabular-nums">
                    {centsToMajor(plan.monthly_price_cents).toFixed(2)}{" "}
                    <span className="text-muted-foreground">{plan.currency}</span>
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {centsToMajor(plan.yearly_price_cents).toFixed(2)}{" "}
                    <span className="text-muted-foreground">{plan.currency}</span>
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums text-muted-foreground">
                    {plan.trial_days ? `${plan.trial_days}d` : "—"}
                  </DataTableCell>
                  <DataTableCell>
                    {plan.is_public ? (
                      <Badge variant="outline">{t("visibility.public")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("visibility.hidden")}</Badge>
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-end">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={planHref(plan.id)} />}
                      >
                        {t("manage")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removing}
                        onClick={() => void onDelete(plan)}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}

            {!loading && plans.length === 0 ? (
              <DataTableEmpty colSpan={7}>{t("empty")}</DataTableEmpty>
            ) : null}
          </TableBody>
        </Table>
      </DataTableCard>

      {creating && (
        <PlanFormDialog
          plan={null}
          onClose={() => setCreating(false)}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  )
}
