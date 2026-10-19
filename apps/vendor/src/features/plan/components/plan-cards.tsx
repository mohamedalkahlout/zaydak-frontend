"use client"

import { useLocale, useTranslations } from "next-intl"
import { Check } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"
import { monthlyEquivalentCents } from "../lib/billing"
import { highlightsFor, type ComparisonMatrix } from "../lib/comparison"
import { formatPrice } from "../lib/format-unit"
import { pickLocale } from "../lib/localize"
import { usePlanChange } from "../lib/use-plan-change"
import { PlanChangeDialog } from "./plan-change-dialog"
import { useCellLabel } from "./plan-cell"
import type {
  BillingInterval,
  CapabilityEntry,
  MyPlanEntry,
  PlanEntry,
} from "../types"

interface Props {
  /** Public tiers, in the server's own order — cheapest first. */
  plans: PlanEntry[]
  current: MyPlanEntry
  interval: BillingInterval
  catalog: CapabilityEntry[]
  matrix: ComparisonMatrix
  /** Refetch the plan queries once a change lands. */
  onChanged: () => void
}

/**
 * The tier cards above the comparison table.
 *
 * Every card quotes a **monthly** figure whichever interval is selected, so the
 * four prices stay comparable; the yearly total moves to the line underneath
 * rather than replacing the number a vendor is scanning.
 *
 * The bullets are derived, not written: each card lists what its tier adds over
 * the one before it, so the row of cards reads as a ladder instead of repeating
 * the whole table four times.
 */
export function PlanCards({
  plans,
  current,
  interval,
  catalog,
  matrix,
  onChanged,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("plan")
  // Routes itself: a first subscription goes to Stripe Checkout, a change to
  // an existing one is quoted and then charged in place.
  const change = usePlanChange(current, onChanged)
  const cellLabel = useCellLabel()

  return (
    <>
    <div
      className={cn(
        "grid gap-4",
        plans.length > 1 && "sm:grid-cols-2",
        plans.length > 2 && "lg:grid-cols-3",
        plans.length > 3 && "xl:grid-cols-4",
      )}
    >
      {plans.map((plan, index) => {
        const isCurrent = plan.id === current.plan.id && !current.is_fallback
        // The tier offers a trial AND this owner still has one to spend. One
        // trial per owner, not per shop — so a vendor who used theirs on
        // another store sees the price they will actually be charged, not a
        // badge promising fourteen free days the server will refuse.
        const trialOffered = plan.trial_days > 0 && current.trial_available
        const yearly = interval === "YEARLY"
        const perMonth = yearly
          ? monthlyEquivalentCents(plan)
          : plan.monthly_price_cents
        // A plan with no price for this interval is assigned by an admin, never
        // bought — the server refuses it, so the button must not offer it.
        const sellable = (yearly ? plan.yearly_price_cents : plan.monthly_price_cents) > 0

        const previous = index > 0 ? matrix.get(plans[index - 1]!.id) : undefined
        const highlights = highlightsFor(catalog, matrix.get(plan.id), previous)

        return (
          <section
            key={plan.id}
            className={cn(
              "flex flex-col gap-4 rounded-xl border bg-card p-5",
              isCurrent && "border-primary ring-1 ring-primary/30",
            )}
          >
            <header className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-lg font-semibold">
                  {pickLocale(plan.name, plan.name_ar, locale)}
                </h3>
                {isCurrent ? (
                  <Badge variant="secondary">{t("currentPlan")}</Badge>
                ) : (
                  trialOffered && (
                    <Badge variant="outline">
                      {t("trialDays", { days: plan.trial_days })}
                    </Badge>
                  )
                )}
              </div>
              {plan.description && (
                <p className="text-sm text-muted-foreground">
                  {pickLocale(plan.description, plan.description_ar, locale)}
                </p>
              )}
            </header>

            <div>
              <p className="flex items-baseline gap-1">
                <span className="font-heading text-3xl font-semibold tabular-nums">
                  {formatPrice(perMonth, plan.currency, locale)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("perMonthShort")}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {yearly
                  ? t("billedYearly", {
                      total: formatPrice(
                        plan.yearly_price_cents,
                        plan.currency,
                        locale,
                      ),
                    })
                  : t("billedMonthly")}
              </p>
            </div>

            <Button
              className="w-full"
              variant={isCurrent ? "outline" : "default"}
              disabled={isCurrent || !sellable || change.pending !== null}
              onClick={() => void change.select(plan, interval)}
            >
              {isCurrent
                ? t("currentPlan")
                : change.pending === plan.id
                  ? t("redirecting")
                  : trialOffered
                    ? t("tryPlan", {
                        name: pickLocale(plan.name, plan.name_ar, locale),
                      })
                    : t("selectPlan", {
                        name: pickLocale(plan.name, plan.name_ar, locale),
                      })}
            </Button>

            <ul className="space-y-2 border-t pt-4 text-sm">
              {index > 0 && (
                <li className="font-medium">
                  {t("everythingIn", {
                    name: pickLocale(
                      plans[index - 1]!.name,
                      plans[index - 1]!.name_ar,
                      locale,
                    ),
                  })}
                </li>
              )}
              {highlights.map(({ capability, cell }) => {
                const value = cellLabel(cell, capability)
                return (
                  <li key={capability.key} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
                      aria-hidden
                    />
                    <span>
                      {pickLocale(capability.name, capability.name_ar, locale)}
                      {value && (
                        <span className="text-muted-foreground">
                          {" — "}
                          {value}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>

    <PlanChangeDialog
      change={change.selected}
      confirming={change.confirming}
      onConfirm={() => void change.confirm()}
      onDismiss={change.dismiss}
    />
    </>
  )
}
