"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
} from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { bpsToPercent } from "@/shared/lib/format"
import type { Target } from "../types"
import {
  formatTargetValue,
  statusBadgeClass,
  statusColor,
} from "../lib/targets"
import { TargetPacingChart } from "./target-pacing-chart"

export function TargetGaugeCard({
  target,
  onEdit,
  onDelete,
}: {
  target: Target
  onEdit: (t: Target) => void
  onDelete: (t: Target) => Promise<void>
}) {
  const t = useTranslations("targets")
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const progress = target.progress
  const status = progress?.status ?? target.status
  const color = statusColor(status)
  const attainmentPct = bpsToPercent(progress?.attainmentBps ?? 0)
  const arcPct = Math.min(100, Math.max(0, attainmentPct))
  const elapsedPct = bpsToPercent(progress?.elapsedBps ?? 0)
  const isEstimated =
    target.metric === "NET_PROFIT" &&
    progress?.costCoverageBps != null &&
    progress.costCoverageBps < 10000

  const doDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(target)
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-semibold">
            {target.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(`metrics.${target.metric}`)} · {t(`periods.${target.period}`)}
          </p>
        </div>
        <Badge className={statusBadgeClass(status)}>
          {t(`statuses.${status}`)}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative size-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                data={[{ value: arcPct, fill: color }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  tick={false}
                />
                <RadialBar background dataKey="value" cornerRadius={16} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {attainmentPct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-muted-foreground">
                {t("attained")}
              </span>
            </div>
          </div>

          <dl className="flex flex-1 flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("current")}</dt>
              <dd className="font-medium tabular-nums">
                {formatTargetValue(progress?.currentValue, target.unit, target.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("goal")}</dt>
              <dd className="font-medium tabular-nums">
                {formatTargetValue(target.targetValue, target.unit, target.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("projected")}</dt>
              <dd className="tabular-nums">
                {progress?.projectedValue != null
                  ? formatTargetValue(progress.projectedValue, target.unit, target.currency)
                  : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("elapsed")}</dt>
              <dd className="tabular-nums">{elapsedPct.toFixed(0)}%</dd>
            </div>
          </dl>
        </div>

        {progress?.paceable && progress.pacingSeries.length > 0 ? (
          <TargetPacingChart
            pacingSeries={progress.pacingSeries}
            idealPaceSeries={progress.idealPaceSeries}
            unit={target.unit}
            currency={target.currency}
          />
        ) : null}

        {isEstimated ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("estimatedNote")}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(target)}>
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirming(true)}
          >
            {t("delete")}
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmBody", { name: target.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={deleting} />}
            >
              {t("cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
