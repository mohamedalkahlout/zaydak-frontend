"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { CalendarClockIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { UPDATE_NOTIFICATION_SETTING } from "../api"
import type { NotificationSettingEntry, UpdateSettingResult } from "../types"

const FREQUENCIES = ["off", "daily", "weekly"] as const
const DAYS = [0, 1, 2, 3, 4, 5, 6]

const selectCls =
  "rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"

/**
 * The Shopify "Store order summary" control: a periodic digest of orders, sales,
 * and top products emailed to staff subscribed to it. Frequency off/daily/weekly
 * with a weekday (weekly) and send hour, evaluated in the shop's timezone. Staged
 * locally, persisted on an explicit Save.
 */
export function OrderSummaryCard({
  setting,
  onSaved,
}: {
  setting: NotificationSettingEntry
  onSaved: () => void
}) {
  const t = useTranslations("notifications")
  const [frequency, setFrequency] = useState(setting.order_summary_frequency)
  const [hour, setHour] = useState(setting.order_summary_hour)
  const [day, setDay] = useState(setting.order_summary_day)
  const [update, { loading: saving }] = useMutation<UpdateSettingResult>(
    UPDATE_NOTIFICATION_SETTING,
  )

  const dirty =
    frequency !== setting.order_summary_frequency ||
    hour !== setting.order_summary_hour ||
    day !== setting.order_summary_day

  async function save() {
    await update({
      variables: {
        input: {
          order_summary_frequency: frequency,
          order_summary_hour: hour,
          order_summary_day: day,
        },
      },
    })
    onSaved()
  }

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <CalendarClockIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("digest.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("digest.desc")}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("digest.frequency")}
              </span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className={selectCls}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`digest.freq.${f}`)}
                  </option>
                ))}
              </select>
            </label>

            {frequency === "weekly" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("digest.day")}
                </span>
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className={selectCls}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {t(`digest.days.${d}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {frequency !== "off" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("digest.time")}
                </span>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className={selectCls}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {frequency !== "off" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("digest.tzNote")}
            </p>
          )}

          {dirty && (
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? t("console.saving") : t("console.save")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
