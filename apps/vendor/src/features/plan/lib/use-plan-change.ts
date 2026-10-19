"use client"

import { useState } from "react"
import { useLazyQuery, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { usePlanError } from "@/shared/lib/plan-errors"
import { CHANGE_PLAN_SUBSCRIPTION } from "../api/mutations"
import { PREVIEW_PLAN_CHANGE } from "../api/queries"
import type {
  BillingInterval,
  MyPlanEntry,
  PlanChangePreview,
  PlanChangeResult,
  PlanEntry,
} from "../types"
import { hasLiveStripeSubscription } from "./status"
import { usePlanCheckout } from "./use-plan-checkout"

/** The tier a vendor picked, held while the quote for it loads. */
export interface PendingChange {
  plan: PlanEntry
  interval: BillingInterval
  /** Null until the server answers. */
  quote: PlanChangePreview | null
}

/**
 * Picking a tier, routed by whether the shop already pays for one.
 *
 * **First subscription goes to Stripe Checkout; every later change does not —
 * and so does a shop an admin assigned a plan to, which has a subscription row
 * but no card behind it.**
 * A shop with a live subscription has a card on file, so the difference is
 * charged in place — sending it back through Checkout opens a SECOND Stripe
 * subscription and bills the vendor for both, which is exactly the bug this
 * split exists to close.
 *
 * The in-place path always quotes first. A vendor is about to be charged a
 * prorated amount they did not choose and cannot predict, so the number has to
 * be on screen before the button that commits it.
 */
export function usePlanChange(current: MyPlanEntry | undefined, onDone: () => void) {
  const t = useTranslations("plan")
  const translateError = usePlanError()
  const checkout = usePlanCheckout()

  const [selected, setSelected] = useState<PendingChange | null>(null)
  const [confirming, setConfirming] = useState(false)

  const [fetchQuote] = useLazyQuery<{
    previewPlanChange: { success: boolean; data?: PlanChangePreview }
  }>(PREVIEW_PLAN_CHANGE, {
    // A quote is only true for the moment it was made — the prorated amount
    // moves with every hour left in the period.
    fetchPolicy: "network-only",
  })

  const [changePlan] = useMutation<{
    changePlanSubscription: { success: boolean; data?: PlanChangeResult }
  }>(CHANGE_PLAN_SUBSCRIPTION)

  /**
   * Only a Stripe-backed subscription can be moved in place. A shop an admin
   * put on a plan by hand goes to Checkout like a first-time buyer — Stripe
   * has nothing of its to prorate.
   */
  const hasSubscription = hasLiveStripeSubscription(current)

  const select = async (plan: PlanEntry, interval: BillingInterval) => {
    if (!hasSubscription) {
      await checkout.checkout(plan, interval)
      return
    }

    setSelected({ plan, interval, quote: null })
    try {
      const res = await fetchQuote({
        variables: { input: { plan_id: plan.id, interval } },
      })
      const quote = res.data?.previewPlanChange.data
      if (!quote) throw new Error("no quote")
      setSelected({ plan, interval, quote })
    } catch (err) {
      // No quote means no dialog: never offer a confirm button with a blank
      // amount on it.
      setSelected(null)
      sileo.error({ title: translateError(err, t("previewFailed")).message })
    }
  }

  const confirm = async () => {
    if (!selected?.quote) return
    setConfirming(true)
    try {
      const res = await changePlan({
        variables: {
          input: { plan_id: selected.plan.id, interval: selected.interval },
        },
      })
      const result = res.data?.changePlanSubscription.data
      if (!result) throw new Error("no result")

      sileo.success({
        title: result.applied
          ? t("planChanged", { name: result.to_plan_name })
          : t("planChangeScheduled", {
              name: result.to_plan_name,
              date: new Date(result.effective_at).toLocaleDateString(),
            }),
      })
      setSelected(null)
      onDone()
    } catch (err) {
      sileo.error({ title: translateError(err, t("changeFailed")).message })
    } finally {
      setConfirming(false)
    }
  }

  return {
    /** The plan id mid-flight, so only the clicked button shows a spinner. */
    pending: checkout.pending ?? (selected && !selected.quote ? selected.plan.id : null),
    selected,
    confirming,
    select,
    confirm,
    dismiss: () => setSelected(null),
  }
}
