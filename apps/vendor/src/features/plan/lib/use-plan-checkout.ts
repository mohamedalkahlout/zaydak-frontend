"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { usePlanError } from "@/shared/lib/plan-errors"
import { START_PLAN_CHECKOUT } from "../api/mutations"
import type { BillingInterval, PlanEntry } from "../types"

/**
 * Hand a plan off to Stripe Checkout.
 *
 * **It navigates away rather than confirming anything.** Nothing here writes
 * subscription state — Stripe's webhook does, because a redirect the browser
 * may never follow is not proof that anything was paid. The screen the vendor
 * comes back to refetches instead of assuming.
 *
 * `pending` is the plan id mid-redirect, not a boolean, so only the button that
 * was clicked spins while the rest stay clickable if the call fails.
 */
export function usePlanCheckout() {
  const t = useTranslations("plan")
  const translateError = usePlanError()

  const [pending, setPending] = useState<string | null>(null)
  const [startCheckout] = useMutation<{
    startPlanCheckout: { success: boolean; data?: { url: string } }
  }>(START_PLAN_CHECKOUT)

  const checkout = async (plan: PlanEntry, interval: BillingInterval) => {
    setPending(plan.id)
    try {
      const res = await startCheckout({
        variables: { input: { plan_id: plan.id, interval } },
      })
      const url = res.data?.startPlanCheckout.data?.url
      if (!url) throw new Error("no url")
      // Same tab: Stripe Checkout is the next step of this flow, not a detour,
      // and a popup here is the one thing a browser reliably blocks.
      window.location.href = url
    } catch (err) {
      // The redirect never happened, so the button has to come back.
      setPending(null)
      sileo.error({ title: translateError(err, t("checkoutFailed")).message })
    }
  }

  return { pending, checkout }
}
