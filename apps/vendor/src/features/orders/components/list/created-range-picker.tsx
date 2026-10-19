"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { DateRange as DayPickerRange } from "react-day-picker"
import { arSA, enUS } from "react-day-picker/locale"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import {
  encodeCustomRange,
  parseCustomRange,
} from "@/features/orders/lib/list/filters"

/**
 * The date chip's custom window, under the preset list. A picked pair is
 * committed as `custom:YYYY-MM-DD:YYYY-MM-DD` — inclusive local days — so a
 * later preset pick replaces it through the menu the bar already has.
 */
export function CreatedRangePicker({
  value,
  onCommit,
}: {
  value: string | undefined
  onCommit: (encoded: string) => void
}) {
  const t = useTranslations("analytics.dateFilter")
  const locale = useLocale()
  const parsed = parseCustomRange(value)
  const [seeded, setSeeded] = useState(value)
  const [draft, setDraft] = useState<DayPickerRange | undefined>(() =>
    parsed ? { from: parsed.start, to: parsed.end } : undefined,
  )
  if (value !== seeded) {
    setSeeded(value)
    setDraft(parsed ? { from: parsed.start, to: parsed.end } : undefined)
  }

  return (
    <div className="border-t border-border">
      <p className="px-3 pt-2 text-xs text-muted-foreground">{t("customRange")}</p>
      <Calendar
        mode="range"
        numberOfMonths={1}
        locale={locale === "ar" ? arSA : enUS}
        selected={draft}
        onSelect={setDraft}
        disabled={{ after: new Date() }}
      />
      <div className="flex justify-end border-t border-border p-2">
        <Button
          size="sm"
          disabled={!draft?.from}
          onClick={() => {
            if (!draft?.from) return
            onCommit(encodeCustomRange(draft.from, draft.to ?? draft.from))
          }}
        >
          {t("apply")}
        </Button>
      </div>
    </div>
  )
}
