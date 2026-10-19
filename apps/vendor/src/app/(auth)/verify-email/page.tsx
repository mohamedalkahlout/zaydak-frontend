"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import { Button } from "@repo/ui/components/button"
import { RESEND_VERIFICATION_EMAIL, VERIFY_EMAIL } from "@/features/auth/api"
import type { ResendVerificationEmailResponse, VerifyEmailResponse } from "@/features/auth/types"
import {
  getRemainingCooldownSeconds,
  startCooldown,
} from "@/shared/lib/auth/cooldown"
import { getErrorCode } from "@/shared/lib/auth/graphql-errors"
import { useAuthStore } from "@/shared/stores/auth"
import { sileo } from "sileo"

const RESEND_COOLDOWN_KEY = "verification-email"

type VerifyState = "checking" | "success" | "expired" | "used" | "invalid" | "missing"

export default function VerifyEmailPage() {
  const t = useTranslations("auth")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerifyState>(token ? "checking" : "missing")
  const [verifyEmail] = useMutation<VerifyEmailResponse>(VERIFY_EMAIL)
  const [resendVerificationEmail, { loading: resending }] =
    useMutation<ResendVerificationEmailResponse>(RESEND_VERIFICATION_EMAIL)
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken))
  const [cooldown, setCooldown] = useState(() =>
    getRemainingCooldownSeconds(RESEND_COOLDOWN_KEY),
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldown(getRemainingCooldownSeconds(RESEND_COOLDOWN_KEY))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const handleResend = async () => {
    try {
      const { data } = await resendVerificationEmail()
      if (data?.resendVerificationEmail?.success) {
        startCooldown(RESEND_COOLDOWN_KEY, 60)
        setCooldown(60)
        sileo.success({
          title: t("verifyEmail.verificationEmailSent"),
          description: t("verifyEmail.checkInboxLink"),
        })
      }
    } catch (err) {
      if (getErrorCode(err) === "OTP_COOLDOWN") {
        startCooldown(RESEND_COOLDOWN_KEY, 60)
        setCooldown(60)
      }
    }
  }

  useEffect(() => {
    if (!token) return

    let cancelled = false
    ;(async () => {
      try {
        const { data } = await verifyEmail({ variables: { token } })
        if (cancelled) return

        if (data?.verifyEmail?.success) {
          setState("success")
          sileo.success({ title: t("verifyEmail.emailVerified") })
          window.setTimeout(() => router.replace("/store"), 1200)
        } else {
          setState("invalid")
        }
      } catch (err) {
        if (cancelled) return

        const code = getErrorCode(err)
        if (code === "OTP_EXPIRED") setState("expired")
        else if (code === "OTP_ALREADY_USED") setState("used")
        else setState("invalid")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, t, token, verifyEmail])

  if (state === "checking") {
    return <p className="text-sm text-muted-foreground">{t("verifyEmail.checking")}</p>
  }

  if (state === "success") {
    return (
      <div className="flex flex-col gap-4">
        <AuthHeading
          eyebrow={t("verifyEmail.eyebrow")}
          title={t("verifyEmail.successTitle")}
          description={t("verifyEmail.successDesc")}
        />
      </div>
    )
  }

  const title =
    state === "missing"
      ? t("verifyEmail.missingTitle")
      : state === "expired"
        ? t("verifyEmail.expiredTitle")
        : state === "used"
          ? t("verifyEmail.usedTitle")
          : t("verifyEmail.invalidTitle")

  const description =
    state === "missing"
      ? t("verifyEmail.missingDesc")
      : state === "expired"
        ? t("verifyEmail.expiredDesc")
        : state === "used"
          ? t("verifyEmail.usedDesc")
          : t("verifyEmail.invalidDesc")

  const canResend = isAuthenticated && (state === "expired" || state === "invalid")

  return (
    <div className="flex flex-col gap-4">
      <AuthHeading
        eyebrow={t("verifyEmail.eyebrow")}
        title={title}
        description={description}
      />
      <div className="flex flex-wrap gap-3">
        {canResend ? (
          <Button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
          >
            {cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : resending
                ? t("sending")
                : t("verifyEmail.resendVerification")}
          </Button>
        ) : null}
        <Button
          variant={canResend ? "outline" : "default"}
          nativeButton={false}
          render={<Link href="/login" />}
        >
          {t("verifyEmail.goToSignIn")}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/store" />}>
          {t("verifyEmail.openDashboard")}
        </Button>
      </div>
    </div>
  )
}
