"use client"

import { CalendarIcon, ChevronDownIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { PERIOD_OPTIONS } from "../lib/targets"
import { resolvePeriodPreview } from "../lib/period-preview"
import type { TargetPeriod } from "../types"

/**
 * Time-period selector for the create-target modal. The trigger shows the
 * resolved window ("July 2026", "Q3 2026", "2026", or a custom range) the way
 * Shopify does; the menu switches the period kind. Picking "Custom period"
 * reveals start/end date inputs.
 */
export function TargetPeriodPicker({
  period,
  onPeriodChange,
  start,
  end,
  onStartChange,
  onEndChange,
  endError,
  labelId,
}: {
  period: TargetPeriod
  onPeriodChange: (period: TargetPeriod) => void
  start: string
  end: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  endError?: string
  /** id of the visible field label, for the trigger's accessible name. */
  labelId?: string
}) {
  const t = useTranslations("targets")
  const locale = useLocale()

  const preview = resolvePeriodPreview(period, { start, end, locale })
  const triggerLabel =
    period === "CUSTOM" && preview.label === "—"
      ? t("periodKinds.CUSTOM")
      : preview.label

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              aria-labelledby={labelId}
              className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
            >
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                {triggerLabel}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        />
        <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-56">
          <DropdownMenuRadioGroup
            value={period}
            onValueChange={(value) => onPeriodChange(value as TargetPeriod)}
          >
            {PERIOD_OPTIONS.map((kind) => (
              <DropdownMenuRadioItem key={kind} value={kind}>
                {t(`periodKinds.${kind}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {period === "CUSTOM" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-start" className="text-xs text-muted-foreground">
              {t("form.start")}
            </Label>
            <Input
              id="target-start"
              type="date"
              value={start}
              onChange={(e) => onStartChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-end" className="text-xs text-muted-foreground">
              {t("form.end")}
            </Label>
            <Input
              id="target-end"
              type="date"
              value={end}
              aria-invalid={!!endError}
              onChange={(e) => onEndChange(e.target.value)}
            />
            {endError ? (
              <p className="text-xs text-destructive">{endError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
