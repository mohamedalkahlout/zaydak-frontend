"use client"

import { useState } from "react"
import { ArrowRightIcon, CalendarIcon, ChevronDownIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import type { DateRange as DayPickerRange } from "react-day-picker"
import { arSA, enUS } from "react-day-picker/locale"
import { cn } from "@/shared/lib/utils"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import {
  RANGE_PRESETS,
  formatRangeLabel,
  rangeForPreset,
  type DateRange,
  type RangePreset,
} from "../lib/date-ranges"

type DraftPreset = RangePreset | "custom"

/** Map a resolved half-open window to the inclusive pair the calendar draws. */
function toDayPickerRange(range: DateRange): DayPickerRange {
  return { from: range.start, to: new Date(range.end.getTime() - 1) }
}

/**
 * The analytics date filter, Shopify-style: one trigger button that opens a
 * popover with a preset rail on the (logical) start side and a two-month
 * calendar on the end side. Presets and a hand-picked custom range are staged
 * together and committed on Apply, so the label under the charts always matches
 * the exact window the queries ran with. The compare-to-previous control is a
 * separate button (`AnalyticsComparison`).
 */
export function AnalyticsDateRange({
  preset,
  onPresetChange,
  effectiveRange,
  onCustomRange,
}: {
  preset: DraftPreset
  onPresetChange: (preset: RangePreset) => void
  effectiveRange: DateRange
  onCustomRange: (range: { start: Date; end: Date }) => void
}) {
  const t = useTranslations("analytics")
  const locale = useLocale()
  const calendarLocale = locale === "ar" ? arSA : enUS
  const [open, setOpen] = useState(false)
  const [draftPreset, setDraftPreset] = useState<DraftPreset>(preset)
  const [draftRange, setDraftRange] = useState<DayPickerRange | undefined>(
    undefined,
  )
  // Controlled first-visible month so picking a far preset (e.g. This year)
  // scrolls the calendar to the range's start instead of leaving it off-screen.
  const [month, setMonth] = useState<Date | undefined>(undefined)

  const openChange = (next: boolean) => {
    if (next) {
      // Seed the draft from whatever is currently in effect.
      setDraftPreset(preset)
      setDraftRange(toDayPickerRange(effectiveRange))
      setMonth(effectiveRange.start)
    }
    setOpen(next)
  }

  const pickPreset = (value: RangePreset) => {
    const range = rangeForPreset(value)
    setDraftPreset(value)
    setDraftRange(toDayPickerRange(range))
    setMonth(range.start)
  }

  const pickCalendar = (range: DayPickerRange | undefined) => {
    setDraftPreset("custom")
    setDraftRange(range)
  }

  const apply = () => {
    if (draftPreset !== "custom") {
      onPresetChange(draftPreset)
    } else if (draftRange?.from) {
      onCustomRange({ start: draftRange.from, end: draftRange.to ?? draftRange.from })
    }
    setOpen(false)
  }

  const triggerLabel =
    preset === "custom"
      ? formatRangeLabel(effectiveRange, locale)
      : t(`ranges.${preset}`)

  const startText = draftRange?.from
    ? draftRange.from.toLocaleDateString(locale, { dateStyle: "medium" })
    : "—"
  const endText = draftRange?.to
    ? draftRange.to.toLocaleDateString(locale, { dateStyle: "medium" })
    : startText

  const presetOptions: DraftPreset[] = [...RANGE_PRESETS, "custom"]

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger
        render={(props) => (
          <Button {...props} variant="outline" className="tabular-nums">
            <CalendarIcon className="size-4 text-muted-foreground" />
            {triggerLabel}
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </Button>
        )}
      />
      <PopoverContent
        align="start"
        className="flex max-h-(--available-height) w-auto max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:flex-row"
        aria-label={t("dateFilter.aria")}
      >
        {/* Preset rail */}
        <div className="flex shrink-0 flex-col gap-0.5 border-b border-border p-2 sm:w-44 sm:border-e sm:border-b-0">
          {presetOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                option === "custom"
                  ? setDraftPreset("custom")
                  : pickPreset(option)
              }
              className={cn(
                "rounded-md px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted",
                draftPreset === option
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {option === "custom"
                ? t("dateFilter.customRange")
                : t(`ranges.${option}`)}
            </button>
          ))}
        </div>

        {/* Calendar + range fields */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2 px-3 pt-3 text-sm tabular-nums">
            <span className="flex-1 rounded-md border border-input px-2.5 py-1.5">
              {startText}
            </span>
            <ArrowRightIcon
              className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
              aria-hidden
            />
            <span className="flex-1 rounded-md border border-input px-2.5 py-1.5">
              {endText}
            </span>
          </div>
          <div className="overflow-x-auto">
            <Calendar
              mode="range"
              numberOfMonths={2}
              locale={calendarLocale}
              selected={draftRange}
              month={month}
              onMonthChange={setMonth}
              disabled={{ after: new Date() }}
              resetOnSelect
              onSelect={pickCalendar}
            />
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border p-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("dateFilter.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={apply}
              disabled={draftPreset === "custom" && !draftRange?.from}
            >
              {t("dateFilter.apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
