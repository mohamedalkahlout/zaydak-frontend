"use client"

import { useLocale, useTranslations } from "next-intl"
import { cn } from "@repo/ui/lib/utils"
import {
  daysUntil,
  isPeriodExpired,
  periodProgress,
  subscriptionState,
} from "../lib/status"
import type { MyPlanEntry } from "../types"

/**
 * The billing period, drawn to scale.
 *
 * Every question a vendor brings to this screen is a question about time:
 * how long is left, when am I charged, when do my quotas reset. They were
 * previously answered by three separate sentences in three places — and, in
 * the sidebar, by a number that was hardcoded. This draws them on one axis,
 * from the real `current_period_start` to the real `current_period_end`, with
 * today marked where today actually falls.
 *
 * It is deliberately a hairline, not a chart. The information is the position
 * of the marks; anything heavier would be decoration competing with the prices
 * below it.
 *
 * Renders nothing for a store on the free fallback — there is no period to
 * draw, and an empty axis would imply one exists.
 */
export function PeriodRibbon({ my }: { my: MyPlanEntry }) {
  const t = useTranslations("plan")
  const locale = useLocale()

  const progress = periodProgress(my.current_period_start, my.current_period_end)
  if (my.is_fallback || progress === null) return null

  const state = subscriptionState(my)
  // Branched on the predicate rather than on the state word: a PAST_DUE row
  // whose window also closed must keep the payment-failed tone, which is the
  // actionable fact, while still reading "Ended" rather than "Renews Sep 8".
  // Reading the labels off the state would let those two contradict each other.
  const expired = isPeriodExpired(my)
  const left = daysUntil(my.current_period_end)

  const day = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
        })
      : ""

  /**
   * What the end of this window actually is, in the vendor's terms. `expired`
   * comes first because none of the three below it can still happen: a trial
   * that ended, a cancellation that landed, a change scheduled for a date that
   * has gone by.
   */
  const endLabel = expired
    ? t("ribbonEnded")
    : state === "trialing"
      ? t("ribbonTrialEnds")
      : my.cancel_at_period_end
        ? t("ribbonPlanEnds")
        : my.pending_plan
          ? t("ribbonChangesTo", { name: my.pending_plan.name })
          : t("ribbonRenews")

  // Destructive rather than muted for an expired window: the shop has lost
  // something, which is a different thing from being scheduled to.
  const tone =
    state === "past_due" || expired
      ? "bg-destructive"
      : state === "ending"
        ? "bg-muted-foreground"
        : "bg-foreground"

  return (
    <section
      aria-label={t("ribbonLabel")}
      className="rounded-xl border bg-card px-5 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-heading text-sm font-medium">
          {expired
            ? t("ribbonExpired")
            : state === "trialing"
              ? t("ribbonTrialDaysLeft", { days: left })
              : t("ribbonDaysLeft", { days: left })}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {day(my.current_period_start)} — {day(my.current_period_end)}
        </p>
      </div>

      {/* The axis. `aria-hidden` because the two labels around it already say
          everything it shows; a screen reader gains nothing from the geometry. */}
      <div aria-hidden className="relative mt-3 h-px w-full bg-border">
        <div
          className={cn("absolute inset-y-0 start-0", tone)}
          style={{ inlineSize: `${progress * 100}%` }}
        />
        {/* Today. A tick that sits on the line rather than a dot floating
            above it — the position is the datum. */}
        <div
          className={cn("absolute -top-1 h-3 w-px", tone)}
          style={{ insetInlineStart: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-xs text-muted-foreground">
          {expired ? t("ribbonQuotaExpired") : t("ribbonQuotaResets")}
        </p>
        <p className="text-xs font-medium">{endLabel}</p>
      </div>
    </section>
  )
}
