"use client"

import { useEffect, useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { RESEND_VERIFICATION_EMAIL } from "@/features/auth/api"
import type { ResendVerificationEmailResponse } from "@/features/auth/types"
import {
  getRemainingCooldownSeconds,
  startCooldown,
} from "@/shared/lib/auth/cooldown"
import { getErrorCode } from "@/shared/lib/auth/graphql-errors"
import { sileo } from "sileo"

const VERIFICATION_COOLDOWN_KEY = "verification-email"

export function EmailVerificationBanner() {
  const t = useTranslations("emailVerification")
  const tAuth = useTranslations("auth")
  const [cooldown, setCooldown] = useState(() =>
    getRemainingCooldownSeconds(VERIFICATION_COOLDOWN_KEY),
  )
  const [resendVerificationEmail, { loading }] =
    useMutation<ResendVerificationEmailResponse>(RESEND_VERIFICATION_EMAIL)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldown(getRemainingCooldownSeconds(VERIFICATION_COOLDOWN_KEY))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const handleResend = async () => {
    try {
      const { data } = await resendVerificationEmail()
      if (data?.resendVerificationEmail?.success) {
        startCooldown(VERIFICATION_COOLDOWN_KEY, 60)
        setCooldown(60)
        sileo.success({
          title: t("sent"),
          description: t("sentDesc"),
        })
      }
    } catch (err) {
      if (getErrorCode(err) === "OTP_COOLDOWN") {
        startCooldown(VERIFICATION_COOLDOWN_KEY, 60)
        setCooldown(60)
      }
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-sm text-amber-900/80">{t("desc")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
          onClick={handleResend}
          disabled={loading || cooldown > 0}
        >
          {cooldown > 0
            ? tAuth("resendIn", { seconds: cooldown })
            : loading
              ? tAuth("sending")
              : t("resend")}
        </Button>
      </div>
    </div>
  )
}
