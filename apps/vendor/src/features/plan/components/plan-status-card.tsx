"use client"

import Link from "next/link"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { GET_MY_PLAN } from "../api/queries"
import { pickLocale } from "../lib/localize"
import { planUrl } from "../lib/routes"
import {
  daysUntil,
  subscriptionState,
  type SubscriptionState,
} from "../lib/status"
import type { MyPlanEntry } from "../types"

/** What the card says, for one subscription state. */
interface CardLine {
  /** The small line above the plan name. */
  label: string
  /**
   * The line below it. Null when there is nothing true to put there — a plan an
   * admin assigned by hand has no period, so it has no renewal date either.
   */
  action: string | null
  tone: "neutral" | "alert"
  /**
   * A statement rather than a call to action, drawn as quiet text instead of the
   * white button. A store that is paying and up to date is being told where it
   * stands; it is not being asked to do anything.
   */
  quiet?: boolean
}

/**
 * Neutral stand-in while this shop's `myPlan` is in flight.
 *
 * The card must not keep painting another shop's plan across a store switch:
 * `myPlan` has no variables, so Apollo keys it under one `ROOT_QUERY` entry,
 * and `ShopCacheBoundary` only clears that entry in an effect — after paint.
 * A skeleton for the loading gap is honest; "Plus / Renews …" from the shop
 * just left is not.
 */
function PlanStatusCardSkeleton() {
  return (
    <div
      data-testid="plan-status-card-skeleton"
      className="rounded-2xl border border-white/10 bg-zinc-900 p-4"
      aria-hidden
    >
      <div className="h-3 w-16 animate-pulse rounded bg-zinc-700" />
      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-zinc-700" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded bg-zinc-700" />
    </div>
  )
}

/**
 * The sidebar's plan card: what this store is on, and what happens next.
 *
 * **Every line comes from `myPlan`.** What stood here before was a hardcoded
 * "Trial ends in 3 days / Subscribe for $1" that rendered for every store
 * forever — for stores with no trial, for stores already paying, and in a
 * currency this product does not use. On a store whose trial had eleven days
 * left it sat next to a dialog saying so, and contradicted it. The fault was
 * that it was wrong, not that it was there, so the card is permanent and it is
 * the copy that is derived.
 *
 * The five states are not five variations on an upsell. Four of them are asking
 * for something (choose a plan, fix a card, keep the plan, see the plans) and
 * carry the button. The fifth — paying, up to date — has nothing to ask for, so
 * it states the plan and its renewal date and offers no button at all.
 *
 * **Shop scope.** Callers remount this with `key={shopSlug}` when the URL shop
 * changes. Combined with `network-only` on mount, the first paint for the new
 * shop never reads the previous shop's cached `myPlan` — that entry is still
 * there until `ShopCacheBoundary`'s effect runs `clearStore()`. After the first
 * answer, `nextFetchPolicy: cache-first` keeps parent re-renders cheap.
 */
export function PlanStatusCard({ shopSlug }: { shopSlug: string | null }) {
  const t = useTranslations("plan")
  const locale = useLocale()

  const { data, loading } = useQuery<{ myPlan: { data?: MyPlanEntry } }>(
    GET_MY_PLAN,
    {
      // No shop in the URL means no X-SHOP header, and the query would be
      // rejected. The store picker is the only screen that hits this.
      skip: !shopSlug,
      // Do not paint ROOT_QUERY.myPlan from the shop we just left. Remount
      // (key=shopSlug) makes this the first policy for every store entry.
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
    },
  )

  if (!shopSlug) return null

  const my = data?.myPlan.data
  // Prefer a blank card over another shop's plan. On remount (`key=shopSlug`)
  // `network-only` starts with `loading` and no result, so this is the gap
  // before the new shop answers — not a forever empty state.
  if (loading) return <PlanStatusCardSkeleton />
  if (!my) return null

  const state = subscriptionState(my)
  const href = planUrl(shopSlug)
  const date = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
        })
      : ""

  /**
   * A scheduled downgrade outranks the renewal date. The shop is still on this
   * tier and keeps it until then, but "renews" would contradict the change the
   * vendor just made and read as though the button did nothing.
   */
  const pending =
    my.pending_plan && my.pending_change_at
      ? {
          name: pickLocale(my.pending_plan.name, my.pending_plan.name_ar, locale),
          date: date(my.pending_change_at),
        }
      : null

  const copy: Record<SubscriptionState, CardLine> = {
    trialing: {
      // Rounded up: with 18 hours left a vendor is on their last day, and
      // "0 days" would read as expired while the trial is still running.
      label: t("sidebarTrialDays", { days: daysUntil(my.trial_ends_at) }),
      action: t("sidebarChoosePlan"),
      tone: "neutral",
    },
    past_due: {
      // The only in-app signal that a card failed. Stripe retries for days and
      // the store keeps working throughout, which is exactly why nothing else
      // on screen would tell the vendor anything is wrong.
      label: t("sidebarPaymentFailed"),
      action: t("sidebarFixPayment"),
      tone: "alert",
    },
    expired: {
      // The window closed and nothing renewed it. A countdown or a renewal
      // date here would both be claims about a future this row does not have.
      label: t("sidebarExpired"),
      action: t("sidebarSeePlans"),
      tone: "alert",
    },
    ending: {
      label: t("sidebarEndsOn", { date: date(my.current_period_end) }),
      action: t("sidebarKeepPlan"),
      tone: "neutral",
    },
    free: {
      label: t("sidebarOnFree"),
      action: t("sidebarSeePlans"),
      tone: "neutral",
    },
    current: {
      label: t("yourPlan"),
      action: pending
        ? t("changesOn", { name: pending.name, date: pending.date })
        : my.current_period_end
          ? t("renewsOn", { date: date(my.current_period_end) })
          : null,
      tone: "neutral",
      quiet: true,
    },
  }

  const line = copy[state]

  return (
    <Link
      href={href}
      className="group/plan block rounded-2xl border border-white/10 bg-zinc-900 p-4 transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
    >
      <p
        className={
          line.tone === "alert"
            ? "text-xs font-medium tracking-wide text-red-300 uppercase"
            : "text-xs font-medium tracking-wide text-zinc-400 uppercase"
        }
      >
        {line.label}
      </p>
      <p className="mt-1 text-sm font-bold text-zinc-100">
        {pickLocale(my.plan.name, my.plan.name_ar, locale)}
      </p>
      {line.action &&
        (line.quiet ? (
          <p className="mt-2 text-xs text-zinc-400">{line.action}</p>
        ) : (
          /* A div, not a Button: the whole card is already the link, and a
             button inside an anchor is invalid and unreachable by keyboard. */
          <div className="mt-3 w-full rounded-md border border-white bg-white px-3 py-1.5 text-center text-sm font-medium text-zinc-900">
            {line.action}
          </div>
        ))}
    </Link>
  )
}
