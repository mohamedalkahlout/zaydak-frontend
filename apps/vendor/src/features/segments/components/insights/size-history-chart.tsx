"use client"

import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { InsightsHistoryPoint } from "@/features/segments/types"

/**
 * 30-day cumulative size chart — inline SVG, no chart library.
 * Renders a smooth area + line over the history points. The y-axis is
 * auto-scaled to the range of the data.
 */

interface SizeHistoryChartProps {
  points: InsightsHistoryPoint[]
  height?: number
}

export function SizeHistoryChart({
  points,
  height = 160,
}: SizeHistoryChartProps) {
  const t = useTranslations("segments.sizeChart")
  const locale = useLocale()
  const { path, areaPath, max, min, first, last } = useMemo(() => {
    if (!points.length) {
      return { path: "", areaPath: "", max: 0, min: 0, first: 0, last: 0 }
    }
    const values = points.map((p) => p.cumulative)
    const mx = Math.max(...values, 1)
    const mn = Math.min(...values)
    const width = 100 // viewBox width in arbitrary units; svg stretches to container
    const step = width / Math.max(1, points.length - 1)
    const yFor = (v: number) => {
      if (mx === mn) return height / 2
      const ratio = (v - mn) / (mx - mn)
      // Reserve 10px top/bottom padding inside the available height
      return height - 10 - ratio * (height - 20)
    }
    const coords = points.map((p, i) => ({
      x: i * step,
      y: yFor(p.cumulative),
    }))
    const linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(" ")
    const area =
      `M${coords[0].x.toFixed(2)} ${height} ` +
      coords
        .map((c) => `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
        .join(" ") +
      ` L${coords[coords.length - 1].x.toFixed(2)} ${height} Z`
    return {
      path: linePath,
      areaPath: area,
      max: mx,
      min: mn,
      first: values[0],
      last: values[values.length - 1],
    }
  }, [points, height])

  const delta = last - first
  const deltaPct =
    first > 0
      ? new Intl.NumberFormat(locale, {
          style: "percent",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(delta / first)
      : "—"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </div>
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="tabular-nums font-medium text-foreground">
            {last.toLocaleString(locale)}
          </span>
          {delta !== 0 && (
            <span
              className={
                delta > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {delta > 0 ? "+" : ""}
              {delta.toLocaleString(locale)}{" "}
              {first > 0 ? `(${deltaPct})` : ""}
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
      >
        {points.length > 0 ? (
          <>
            <defs>
              <linearGradient id="size-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="currentColor"
                  className="text-primary"
                  stopOpacity={0.18}
                />
                <stop
                  offset="100%"
                  stopColor="currentColor"
                  className="text-primary"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#size-gradient)" />
            <path
              d={path}
              fill="none"
              className="text-primary"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <text
            x="50"
            y={height / 2}
            textAnchor="middle"
            fontSize="6"
            className="fill-muted-foreground"
          >
            {t("noData")}
          </text>
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  )
}
