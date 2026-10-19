"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import type { OrdersByStatusData } from "../types"
import { EmptyRow } from "./card-states"

// Rendered top-to-bottom. Each status maps to an i18n label key and a bar
// color so the proportions read at a glance.
const STATUS_ROWS: Array<{ key: keyof OrdersByStatusData; color: string }> = [
  { key: "pending", color: "bg-amber-400" },
  { key: "processing", color: "bg-sky-400" },
  { key: "at_local_facility", color: "bg-indigo-400" },
  { key: "out_for_delivery", color: "bg-violet-400" },
  { key: "completed", color: "bg-emerald-500" },
  { key: "cancelled", color: "bg-zinc-400" },
  { key: "refunded", color: "bg-rose-400" },
  { key: "failed", color: "bg-red-500" },
]

export function OrdersByStatusCard({
  data,
  loading,
}: {
  data?: OrdersByStatusData
  loading?: boolean
}) {
  const t = useTranslations("analytics")
  const rows = data ? STATUS_ROWS.filter((row) => data[row.key] > 0) : []
  const max = rows.reduce((m, row) => Math.max(m, data ? data[row.key] : 0), 0)

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("ordersByStatus.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bones
          name="analytics-orders-by-status"
          loading={Boolean(loading) && !data}
        >
          <div className="flex flex-col gap-2.5">
            {!rows.length ? (
              <EmptyRow label={t("empty")} />
            ) : (
              rows.map((row) => {
                const count = data ? data[row.key] : 0
                const width = max > 0 ? Math.max(4, (count / max) * 100) : 0
                return (
                  <div key={row.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t(`status.${row.key}`)}
                      </span>
                      <span className="font-medium tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Bones>
      </CardContent>
    </Card>
  )
}
