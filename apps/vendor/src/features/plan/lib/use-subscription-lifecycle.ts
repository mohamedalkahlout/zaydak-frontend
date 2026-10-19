"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"
import { usePlanError } from "@/shared/lib/plan-errors"
import {
  CANCEL_MY_SUBSCRIPTION,
  RESUME_MY_SUBSCRIPTION,
} from "../api/mutations"

interface ScheduleResult {
  effective_at: string
}

/**
 * Cancelling and un-cancelling a subscription, from our own screen.
 *
 * **Neither is immediate.** Cancelling sets the end of the period the shop has
 * already paid for; it keeps its plan until then, because Stripe refunds none
 * of those days. That also makes the action reversible, which is why `resume`
 * exists at all — a vendor who changes their mind on the same day should not
 * have to buy the plan again.
 */
export function useSubscriptionLifecycle(onDone: () => void) {
  const locale = useLocale()
  const t = useTranslations("plan")
  const translateError = usePlanError()
  const [pending, setPending] = useState(false)

  const [cancelSubscription] = useMutation<{
    cancelMySubscription: { success: boolean; data?: ScheduleResult }
  }>(CANCEL_MY_SUBSCRIPTION)

  const [resumeSubscription] = useMutation<{
    resumeMySubscription: { success: boolean; data?: ScheduleResult }
  }>(RESUME_MY_SUBSCRIPTION)

  const on = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

  const run = async (
    call: () => Promise<{ effective_at: string } | undefined>,
    success: (date: string) => string,
    fallback: string,
  ) => {
    setPending(true)
    try {
      const data = await call()
      if (!data) throw new Error("no result")
      sileo.success({ title: success(on(data.effective_at)) })
      onDone()
    } catch (err) {
      sileo.error({ title: translateError(err, t(fallback)).message })
    } finally {
      setPending(false)
    }
  }

  return {
    pending,
    cancel: () =>
      run(
        () =>
          cancelSubscription().then(
            (res) => res.data?.cancelMySubscription.data,
          ),
        (date) => t("cancelScheduled", { date }),
        "cancelFailed",
      ),
    resume: () =>
      run(
        () =>
          resumeSubscription().then(
            (res) => res.data?.resumeMySubscription.data,
          ),
        (date) => t("resumed", { date }),
        "resumeFailed",
      ),
  }
}
