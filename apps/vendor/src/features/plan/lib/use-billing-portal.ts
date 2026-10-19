"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { usePlanError } from "@/shared/lib/plan-errors"
import { OPEN_BILLING_PORTAL } from "../api/mutations"

/**
 * The hand-off to Stripe's hosted billing portal.
 *
 * A hook rather than a handler passed down, because two surfaces open it: the
 * alert banner in the shell (where a failed card is the thing to fix) and the
 * billing page (where cards live). Duplicating the redirect would duplicate the
 * `pending` flag it exists to hold, and a second copy is how one of them ends
 * up spinning forever after a failure.
 *
 * `pending` is never cleared on success — the browser is leaving the page, and
 * clearing it would flash the button back to its idle label mid-navigation.
 */
export function useBillingPortal() {
  const t = useTranslations("plan")
  const translateError = usePlanError()
  const [pending, setPending] = useState(false)
  const [openPortal] = useMutation<{
    openBillingPortal: { success: boolean; data?: { url: string } }
  }>(OPEN_BILLING_PORTAL)

  const open = async () => {
    setPending(true)
    try {
      const res = await openPortal()
      const url = res.data?.openBillingPortal.data?.url
      if (!url) throw new Error("no url")
      window.location.href = url
    } catch (err) {
      setPending(false)
      sileo.error({ title: translateError(err, t("portalFailed")).message })
    }
  }

  return { pending, open: () => void open() }
}
