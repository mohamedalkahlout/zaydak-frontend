"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { subscriptionState } from "../lib/status"
import type { MyPlanEntry } from "../types"

interface Props {
  my: MyPlanEntry
  onManageBilling: () => void
  onResume: () => void
  pending: boolean
  portalPending: boolean
  /** Where "choose a plan" goes. Null when there is no shop in the URL. */
  plansHref?: string | null
}

/**
 * The one thing that has gone wrong, said at the top of the page.
 *
 * **`PAST_DUE` is the case this exists for.** When a card fails, Stripe
 * retries for days and the store keeps every capability it had — deliberately,
 * so one expired card does not take a working shop down. The cost of that
 * kindness is that nothing anywhere looks wrong, and the back-end sends no
 * mail. Without this banner the first thing a vendor learns is that their plan
 * is gone.
 *
 * A scheduled end gets the same treatment for the opposite reason: it is
 * reversible right up to the date, and the undo should not be buried three
 * sections down next to "manage billing".
 */
export function PlanAlert({
  my,
  onManageBilling,
  onResume,
  pending,
  portalPending,
  plansHref,
}: Props) {
  const t = useTranslations("plan")
  const locale = useLocale()
  const state = subscriptionState(my)

  if (state !== "past_due" && state !== "ending" && state !== "expired")
    return null

  const date = my.current_period_end
    ? new Date(my.current_period_end).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  // An expired plan is a thing that has gone wrong, not a scheduled event, so
  // it keeps the destructive shell and the `role="alert"`.
  const isFailure = state === "past_due" || state === "expired"

  return (
    <section
      role={isFailure ? "alert" : undefined}
      className={
        isFailure
          ? "rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4"
          : "rounded-xl border bg-muted/40 px-5 py-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-prose">
          <p
            className={
              isFailure
                ? "font-heading text-sm font-semibold text-destructive"
                : "font-heading text-sm font-semibold"
            }
          >
            {state === "expired"
              ? t("alertExpiredTitle")
              : isFailure
                ? t("alertPastDueTitle")
                : t("alertEndingTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {state === "expired"
              ? date
                ? t("alertExpiredBody", { date })
                : t("alertExpiredBodyNoDate")
              : state === "past_due"
                ? t("alertPastDueBody")
                : date
                  ? t("alertEndingBody", { date })
                  : t("alertEndingBodyNoDate")}
          </p>
        </div>

        {/* Expired drops the resume button: resuming is offered right up to
            the date and not after it — a window that closed four days ago has
            nothing left to keep. With no `plansHref` the copy still stands on
            its own, and an alert with no action beats no alert. */}
        {state === "expired" ? (
          plansHref ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={plansHref} />}
            >
              {t("choosePlan")}
            </Button>
          ) : null
        ) : state === "past_due" ? (
          <Button
            size="sm"
            disabled={portalPending}
            onClick={onManageBilling}
          >
            {portalPending ? t("redirecting") : t("alertFixPayment")}
          </Button>
        ) : (
          <Button size="sm" disabled={pending} onClick={onResume}>
            {t("resumeSubscription")}
          </Button>
        )}
      </div>
    </section>
  )
}
