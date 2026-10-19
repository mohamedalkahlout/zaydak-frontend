"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import { cn } from "@/shared/lib/utils"
import { bpsToPercent } from "@/shared/lib/format"
import { cohortCellStyle } from "@/features/customer-analytics/lib/cohort"
import type { CohortRow } from "@/features/customer-analytics/types"
import { EmptyRow } from "./card-states"

/**
 * Compact monthly cohort-retention matrix (Shopify's "Customer cohort
 * analysis" card) — the full report lives on the customer insights page.
 */
export function CohortMiniCard({
  cohorts,
  loading,
  viewHref,
  className,
}: {
  cohorts?: CohortRow[]
  loading?: boolean
  viewHref: string
  className?: string
}) {
  const t = useTranslations("analytics")

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>{t("cohorts.title")}</CardTitle>
        <Link
          href={viewHref}
          className="shrink-0 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          {t("viewReport")}
        </Link>
      </CardHeader>
      <CardContent>
        <Bones name="analytics-cohorts" loading={Boolean(loading) && !cohorts}>
          {!cohorts?.length ? (
            <EmptyRow label={t("empty")} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 pe-2 text-start font-normal">
                    {t("cohorts.cohort")}
                  </th>
                  <th className="py-1 pe-2 text-start font-normal tabular-nums">
                    {t("cohorts.size")}
                  </th>
                  {cohorts[0].retention_bps.map((_, i) => (
                    <th key={i} className="px-1 py-1 text-center font-normal">
                      {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((row) => (
                  <tr key={row.cohort}>
                    <td className="py-0.5 pe-2 whitespace-nowrap text-muted-foreground">
                      {row.cohort}
                    </td>
                    <td className="py-0.5 pe-2 tabular-nums text-muted-foreground">
                      {row.size}
                    </td>
                    {row.retention_bps.map((bps, i) => (
                      <td
                        key={i}
                        className="rounded px-1.5 py-0.5 text-center tabular-nums"
                        style={cohortCellStyle(bps)}
                      >
                        {bpsToPercent(bps).toFixed(0)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Bones>
      </CardContent>
    </Card>
  )
}
