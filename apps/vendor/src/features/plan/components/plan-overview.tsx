"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  GET_MY_ENTITLEMENTS,
  GET_MY_PLAN,
  GET_MY_USAGE,
} from "../api/queries"
import { byGroup } from "../lib/entitlements"
import { formatPrice, formatReset } from "../lib/format-unit"
import { groupLabel, pickLocale } from "../lib/localize"
import { planTabUrl } from "../lib/routes"
import { isPeriodExpired } from "../lib/status"
import { PeriodRibbon } from "./period-ribbon"
import { UsageMeter } from "./usage-meter"
import type { EntitlementEntry, MyPlanEntry, UsageEntry } from "../types"

/**
 * How many meters the overview shows before handing off to the usage tab.
 *
 * Two, because the point here is "is anything about to run out", not "what have
 * I used" — the second question has a page of its own now. They are picked by
 * how full they are, so the one that matters is the one shown.
 */
const GLANCE_METERS = 2

/**
 * The plan screen's front door: what this store is on, and what it includes.
 *
 * It answers one question — "where do I stand" — and hands every other question
 * to the tab that owns it. What it deliberately does **not** carry any more is
 * the tier comparison: a four-column table below the fold made this page the
 * long one, and a vendor who wants to compare tiers has said so by clicking
 * Plans.
 */
export function PlanOverview() {
  const locale = useLocale()
  const t = useTranslations("plan")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const { data: planData } = useQuery<{
    myPlan: { success: boolean; data?: MyPlanEntry }
  }>(GET_MY_PLAN)
  const { data: entData } = useQuery<{
    myEntitlements: { success: boolean; data?: EntitlementEntry[] }
  }>(GET_MY_ENTITLEMENTS)
  // Usage is read fresh: the counter moves the moment anything is consumed, and
  // a stale "remaining" is the one number a vendor will act on.
  const { data: usageData } = useQuery<{
    myUsage: { success: boolean; data?: UsageEntry[] }
  }>(GET_MY_USAGE, { fetchPolicy: "cache-and-network" })

  const my = planData?.myPlan.data
  if (!my) return null

  const entitlements = entData?.myEntitlements.data ?? []
  const usage = usageData?.myUsage.data ?? []
  const nameFor = (e: EntitlementEntry) => pickLocale(e.name, e.name_ar, locale)

  const metered = usage
    .filter((u) => entitlements.some((e) => e.key === u.key && e.enabled))
    // Fullest first, and an unlimited allowance last: it can never be the one
    // about to stop working.
    .sort((a, b) => fullness(b) - fullness(a))

  const renews = formatReset(my.current_period_end, locale)
  const pendingDate = my.pending_change_at
    ? formatReset(my.pending_change_at, locale)
    : null
  const pendingChange =
    my.pending_plan && pendingDate
      ? {
          name: pickLocale(my.pending_plan.name, my.pending_plan.name_ar, locale),
          date: pendingDate,
        }
      : null

  return (
    <>
      {/* ─── The period, drawn to scale ───────────────────────────────── */}
      <PeriodRibbon my={my} />

      {/* ─── Current plan ─────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("yourPlan")}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold">
                {pickLocale(my.plan.name, my.plan.name_ar, locale)}
              </h2>
              {my.status === "TRIALING" && (
                <Badge variant="secondary">{t("trial")}</Badge>
              )}
              {my.is_fallback && <Badge variant="outline">{t("free")}</Badge>}
            </div>
            {my.plan.description && (
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                {pickLocale(my.plan.description, my.plan.description_ar, locale)}
              </p>
            )}
          </div>

          {!my.is_fallback && (
            <div className="text-end">
              <p className="font-medium tabular-nums">
                {formatPrice(
                  my.interval === "YEARLY"
                    ? my.plan.yearly_price_cents
                    : my.plan.monthly_price_cents,
                  my.plan.currency,
                  locale,
                )}
              </p>
              {renews && (
                <p className="text-xs text-muted-foreground">
                  {/*
                    A scheduled downgrade outranks both: the shop keeps this
                    tier until the date, then drops. Saying "renews" there
                    would contradict the change the vendor just made. An
                    expired window outranks even that, for the same reason —
                    the most recent truth wins, and a change scheduled for a
                    window that already closed will not happen on time either.
                  */}
                  {isPeriodExpired(my)
                    ? t("endedOn", { date: renews })
                    : pendingChange
                      ? t("changesOn", {
                          name: pendingChange.name,
                          date: pendingChange.date,
                        })
                      : my.cancel_at_period_end
                        ? t("endsOn", { date: renews })
                        : t("renewsOn", { date: renews })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {my.billing_enabled && shopSlug && (
            <Button
              size="sm"
              render={<Link href={planTabUrl(shopSlug, "plans")} />}
            >
              {my.is_fallback ? t("seePlans") : t("changePlan")}
            </Button>
          )}
          {/*
            Cards, invoices and cancellation moved to their own tab. The button
            only appears once there is a Stripe customer behind it — a shop an
            admin put on a plan by hand has nothing to show there.
          */}
          {my.billing_enabled && my.has_billing_account && shopSlug && (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={planTabUrl(shopSlug, "billing")} />}
            >
              {t("tab.billing")}
            </Button>
          )}
          {/*
            Billing off on this deployment: an admin assigns plans by hand, so
            saying so beats a button that always errors.
          */}
          {!my.billing_enabled && (
            <p className="text-xs text-muted-foreground">{t("changeNote")}</p>
          )}
        </div>
      </section>

      {/* ─── Usage at a glance ────────────────────────────────────────── */}
      {metered.length > 0 && shopSlug && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-medium">{t("usageTitle")}</h2>
              <p className="text-xs text-muted-foreground">{t("usageHint")}</p>
            </div>
            <Link
              href={planTabUrl(shopSlug, "usage")}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t("seeAllUsage")}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {metered.slice(0, GLANCE_METERS).map((u) => {
              const entitlement = entitlements.find((e) => e.key === u.key)
              return (
                <UsageMeter
                  key={u.key}
                  usage={u}
                  label={entitlement ? nameFor(entitlement) : u.key}
                  locale={locale}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* ─── What this shop actually has ──────────────────────────────── */}
      {/*
        Not the same list as the comparison table on the Plans tab: this is the
        RESOLVED map, so a limit support raised by hand shows here and nowhere
        else.
      */}
      <section className="rounded-xl border bg-card">
        <header className="border-b px-5 py-3">
          <h2 className="font-medium">{t("includesTitle")}</h2>
        </header>
        <div className="divide-y">
          {byGroup(entitlements).map(([group, caps]) => (
            <div key={group} className="px-5 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {groupLabel(group, t)}
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {caps.map((cap) => (
                  <li
                    key={cap.key}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span
                      className={
                        cap.enabled ? "" : "text-muted-foreground line-through"
                      }
                    >
                      {nameFor(cap)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {!cap.enabled
                        ? t("notIncluded")
                        : cap.limit_value === null ||
                            cap.limit_value === undefined
                          ? t("unlimited")
                          : cap.limit_value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/** How close a meter is to its ceiling. Unlimited sorts last, never first. */
function fullness(u: UsageEntry): number {
  if (u.limit_value === null || u.limit_value === undefined) return -1
  if (u.limit_value === 0) return u.used > 0 ? 1 : 0
  return u.used / u.limit_value
}
