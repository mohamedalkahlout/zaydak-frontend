"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { cn } from "@repo/ui/lib/utils"
import {
  GET_FEATURE_CATALOG,
  GET_MY_ENTITLEMENTS,
  GET_MY_PLAN,
  GET_PLANS,
  GET_PLAN_COMPARISON,
} from "../api/queries"
import { monthlyEquivalentCents, yearlySavingPercent } from "../lib/billing"
import { buildMatrix } from "../lib/comparison"
import { formatPrice } from "../lib/format-unit"
import { PlanCards } from "./plan-cards"
import { PlanComparison } from "./plan-comparison"
import type {
  BillingInterval,
  CapabilityEntry,
  MyPlanEntry,
  PlanComparisonEntry,
  PlanEntry,
} from "../types"

/**
 * Every tier, side by side, and the way onto one.
 *
 * A route of its own since the plan screen was split: the four-column table is
 * the tallest thing in this feature, and it was the reason a vendor checking
 * their renewal date had to scroll past four prices to reach it. Here it is the
 * whole page, which is what a comparison table wants to be.
 *
 * Everything renders from the server's own lists — the tiers, the capability
 * catalog and the per-plan matrix — so a capability shipped next month appears
 * with no change to this file.
 */
export function PlanPicker() {
  const locale = useLocale()
  const t = useTranslations("plan")

  const { data: planData, refetch: refetchPlan } = useQuery<{
    myPlan: { success: boolean; data?: MyPlanEntry }
  }>(GET_MY_PLAN)
  const { refetch: refetchEntitlements } = useQuery<{
    myEntitlements: { success: boolean; data?: unknown[] }
  }>(GET_MY_ENTITLEMENTS)

  // The pricing table's three inputs. None is shop-scoped, so all three cache
  // for the session.
  const { data: plansData } = useQuery<{
    plans: { success: boolean; data?: PlanEntry[] }
  }>(GET_PLANS)
  const { data: catalogData } = useQuery<{
    featureCatalog: { success: boolean; data?: CapabilityEntry[] }
  }>(GET_FEATURE_CATALOG)
  const { data: comparisonData } = useQuery<{
    planComparison: { success: boolean; data?: PlanComparisonEntry[] }
  }>(GET_PLAN_COMPARISON)

  const plans = useMemo(() => plansData?.plans.data ?? [], [plansData])
  const catalog = catalogData?.featureCatalog.data ?? []
  const matrix = useMemo(
    () => buildMatrix(comparisonData?.planComparison.data ?? []),
    [comparisonData],
  )

  const [interval, setInterval] = useState<BillingInterval>("MONTHLY")
  // The switch opens on the interval the shop already pays on, but only once
  // the plan query has answered. Latched during render rather than in an
  // effect — the supported React pattern for deriving initial state from data
  // that arrives late, and it lands before paint, so the prices never jump
  // under the cursor.
  const [syncedInterval, setSyncedInterval] = useState(false)
  const my = planData?.myPlan.data
  if (my && !syncedInterval) {
    setSyncedInterval(true)
    if (my.interval === "YEARLY") setInterval("YEARLY")
  }

  const saving = yearlySavingPercent(plans)

  /**
   * The headline figure. Priced tiers only — a $0 fallback would make every
   * deployment claim it starts at nothing.
   */
  const startingAt = useMemo(() => {
    const prices = plans
      .map((p) =>
        interval === "YEARLY" ? monthlyEquivalentCents(p) : p.monthly_price_cents,
      )
      .filter((cents) => cents > 0)
    if (prices.length === 0) return null
    const cheapest = Math.min(...prices)
    return formatPrice(cheapest, plans[0]!.currency, locale)
  }, [plans, interval, locale])

  if (!my) return null
  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPlans")}</p>
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {startingAt
              ? t("startingAt", { price: startingAt })
              : t("choosePlanTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {my.billing_enabled ? t("upgradeHint") : t("changeNote")}
          </p>
        </div>

        {/* Interval switch. Yearly is only badged when it actually saves. */}
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {(["MONTHLY", "YEARLY"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              aria-pressed={interval === value}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                interval === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "MONTHLY" ? t("monthly") : t("yearly")}
              {value === "YEARLY" && saving !== null && (
                <span className="ms-1 opacity-80">
                  {t("savePercent", { percent: saving })}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Every button in the card grid hands off to Stripe, so the grid is
          hidden outright on a deployment with no Stripe configured. */}
      {my.billing_enabled && (
        <>
          <PlanCards
            plans={plans}
            current={my}
            interval={interval}
            catalog={catalog}
            matrix={matrix}
            onChanged={() => {
              // An in-place change is applied by the time the mutation
              // answers — unlike Checkout there is no webhook to wait on, so
              // one refetch is enough. Entitlements move with the plan.
              void refetchPlan()
              void refetchEntitlements()
            }}
          />
          <p className="text-xs text-muted-foreground">{t("stripeNote")}</p>
        </>
      )}

      {catalog.length > 0 && (
        <PlanComparison
          plans={plans}
          current={my}
          catalog={catalog}
          matrix={matrix}
        />
      )}
    </section>
  )
}
