"use client"

import { Fragment, useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { cn } from "@repo/ui/lib/utils"
import {
  cellFor,
  groupCatalog,
  isEmptyRow,
  type ComparisonMatrix,
} from "../lib/comparison"
import { formatPrice } from "../lib/format-unit"
import { groupLabel, pickLocale } from "../lib/localize"
import { ComparisonCell } from "./plan-cell"
import type { CapabilityEntry, MyPlanEntry, PlanEntry } from "../types"

interface Props {
  plans: PlanEntry[]
  current: MyPlanEntry
  catalog: CapabilityEntry[]
  matrix: ComparisonMatrix
}

/**
 * The full comparison table: every capability the product sells, against every
 * public tier.
 *
 * Rows come from the catalog and cells from the plan matrix, so the table is
 * the server's answer rather than a hand-kept copy of it — a capability added
 * next month appears in its group with no change here.
 *
 * A row excluded from every tier is dropped. It is not information, and on a
 * deployment that has enabled half the catalog it would be most of the table.
 */
export function PlanComparison({ plans, current, catalog, matrix }: Props) {
  const locale = useLocale()
  const t = useTranslations("plan")

  const groups = useMemo(() => groupCatalog(catalog), [catalog])

  /** One label column plus one per plan — the colspan every heading row needs. */
  const columns = plans.length + 1

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">{t("compareTitle")}</h2>

      {/*
        The table scrolls inside its own box rather than widening the page: at
        four tiers plus a label column it does not fit a phone, and a page that
        scrolls sideways loses the sidebar with it.
      */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">{t("compareTitle")}</caption>
          <thead>
            {/* Sticky against the dashboard's own scroll container, so the tier
                names stay readable however far down the table you are. */}
            <tr className="sticky top-0 z-10 bg-card">
              <th
                scope="col"
                className="w-[34%] border-b px-4 py-3 text-start font-medium"
              >
                <span className="sr-only">{t("capabilityColumn")}</span>
              </th>
              {plans.map((plan) => {
                const isCurrent =
                  plan.id === current.plan.id && !current.is_fallback
                return (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn(
                      "border-b px-4 py-3 text-center font-semibold",
                      isCurrent && "text-primary",
                    )}
                  >
                    {pickLocale(plan.name, plan.name_ar, locale)}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {/* ─── Pricing ──────────────────────────────────────────────── */}
            <GroupHeading label={t("pricingGroup")} colSpan={columns} />
            <tr className="border-b">
              <th scope="row" className="px-4 py-2.5 text-start font-normal">
                {t("payMonthly")}
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-2.5 text-center tabular-nums">
                  {formatPrice(plan.monthly_price_cents, plan.currency, locale)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <th scope="row" className="px-4 py-2.5 text-start font-normal">
                {t("payYearly")}
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-2.5 text-center tabular-nums">
                  {formatPrice(plan.yearly_price_cents, plan.currency, locale)}
                </td>
              ))}
            </tr>

            {/* ─── Capabilities ─────────────────────────────────────────── */}
            {groups.map((group) => {
              const rows = group.capabilities
                .map((capability) => ({
                  capability,
                  cells: plans.map((plan) =>
                    cellFor(capability, matrix.get(plan.id)?.get(capability.key)),
                  ),
                }))
                .filter((row) => !isEmptyRow(row.cells))

              if (rows.length === 0) return null

              return (
                <Fragment key={group.group}>
                  <GroupHeading
                    label={groupLabel(group.group, t)}
                    colSpan={columns}
                    capitalize
                  />
                  {rows.map(({ capability, cells }) => (
                    <tr key={capability.key} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="px-4 py-2.5 text-start font-normal"
                      >
                        {pickLocale(capability.name, capability.name_ar, locale)}
                      </th>
                      {cells.map((cell, index) => (
                        <td
                          key={plans[index]!.id}
                          className="px-4 py-2.5 text-center"
                        >
                          <ComparisonCell cell={cell} capability={capability} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GroupHeading({
  label,
  colSpan,
  capitalize = false,
}: {
  label: string
  colSpan: number
  capitalize?: boolean
}) {
  return (
    <tr className="bg-muted/50">
      <th
        scope="colgroup"
        colSpan={colSpan}
        className={cn(
          "border-y px-4 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          capitalize && "capitalize",
        )}
      >
        {label}
      </th>
    </tr>
  )
}
