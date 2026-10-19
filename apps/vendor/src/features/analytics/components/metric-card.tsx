"use client"

import type * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import { DeltaBadge } from "./delta-badge"
import type { Delta } from "../lib/metrics"

export function MetricCard({
  label,
  value,
  valueContent,
  delta,
  goodWhen,
  loading,
  hint,
  boneName = "analytics-kpi-figure",
}: {
  label: string
  value: string
  /** Optional custom node for the figure (e.g. an auto-scaling amount); falls
   *  back to `value` rendered as heading text when omitted. */
  valueContent?: React.ReactNode
  delta?: Delta | null
  goodWhen?: "up" | "down"
  loading?: boolean
  hint?: string
  /**
   * Which captured figure to show while loading. Defaults to one shape shared
   * by every KPI on every analytics page, which is exact — all twenty call
   * sites previously drew the same `h-7 w-24` bar. Override only for a figure
   * that is structurally different, as the Total sales card's `AutoscaleInput`
   * is.
   */
  boneName?: string
}) {
  return (
    <Card size="sm" className="gap-2">
      <CardHeader className="pb-0">
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <Bones name={boneName} loading={Boolean(loading)}>
          {valueContent ?? (
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {value}
            </span>
          )}
        </Bones>
        {!loading && delta ? <DeltaBadge delta={delta} goodWhen={goodWhen} /> : null}
      </CardContent>
      {hint ? (
        <p className="px-4 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  )
}
