"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { CalendarIcon, ChevronDownIcon } from "lucide-react"
import type { DateRange as DayPickerRange } from "react-day-picker"
import { arSA, enUS } from "react-day-picker/locale"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"
import {
  RANGE_PRESETS,
  formatRangeLabel,
  rangeForPreset,
  resolvedRange,
  toIsoDate,
  type AbandonedCartsQueryState,
  type RangePreset,
} from "@/features/abandoned-carts/lib/query-state"

function rangeMessageKey(
  preset: Exclude<RangePreset, "custom">,
): "last7" | "last30" | "thisMonth" | "allTime" {
  if (preset === "last_7_days") return "last7"
  if (preset === "last_30_days") return "last30"
  if (preset === "all_time") return "allTime"
  return "thisMonth"
}

export function AbandonedCartsRange({
  state,
  onChange,
}: {
  state: Pick<AbandonedCartsQueryState, "range" | "from" | "to">
  onChange: (next: { range: RangePreset; from?: string; to?: string }) => void
}) {
  const t = useTranslations("abandonedCarts")
  const locale = useLocale()
  const calendarLocale = locale === "ar" ? arSA : enUS
  const dated = resolvedRange(state)
  const [open, setOpen] = useState(false)
  const [draftPreset, setDraftPreset] = useState<RangePreset>(state.range)
  const [draftRange, setDraftRange] = useState<DayPickerRange | undefined>()
  const [month, setMonth] = useState<Date | undefined>(undefined)

  const openChange = (next: boolean) => {
    if (next) {
      setDraftPreset(state.range)
      if (dated) {
        setDraftRange({
          from: dated.start,
          to: new Date(dated.end.getTime() - 1),
        })
        setMonth(dated.start)
      } else {
        setDraftRange(undefined)
        setMonth(undefined)
      }
    }
    setOpen(next)
  }

  const pickPreset = (value: Exclude<RangePreset, "custom">) => {
    setDraftPreset(value)
    if (value === "all_time") {
      setDraftRange(undefined)
      return
    }
    const range = rangeForPreset(value)
    setDraftRange({
      from: range.start,
      to: new Date(range.end.getTime() - 1),
    })
    setMonth(range.start)
  }

  const apply = () => {
    if (draftPreset === "all_time") {
      onChange({ range: "all_time" })
    } else if (draftPreset !== "custom") {
      onChange({ range: draftPreset })
    } else if (draftRange?.from) {
      const from = toIsoDate(draftRange.from)
      const to = toIsoDate(draftRange.to ?? draftRange.from)
      onChange({ range: "custom", from, to })
    }
    setOpen(false)
  }

  const triggerLabel =
    state.range === "all_time" || !dated
      ? t("range.allTime")
      : formatRangeLabel(dated, locale)

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            size="sm"
            className="tabular-nums"
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {triggerLabel}
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </Button>
        )}
      />
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col gap-3 p-3 sm:flex-row">
          <div className="flex min-w-36 flex-col gap-1">
            {RANGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={draftPreset === preset ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => pickPreset(preset)}
              >
                {t(`range.${rangeMessageKey(preset)}`)}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            locale={calendarLocale}
            month={month}
            onMonthChange={setMonth}
            selected={draftRange}
            onSelect={(range) => {
              setDraftPreset("custom")
              setDraftRange(range)
            }}
            numberOfMonths={1}
          />
        </div>
        <div className="flex justify-end border-t border-border p-2">
          <Button
            type="button"
            size="sm"
            onClick={apply}
            disabled={draftPreset === "custom" && !draftRange?.from}
            className={cn("min-w-20")}
          >
            {t("range.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
