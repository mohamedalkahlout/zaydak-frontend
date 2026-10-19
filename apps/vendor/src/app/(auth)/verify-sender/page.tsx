"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import { Button } from "@repo/ui/components/button"
import { VERIFY_SENDER } from "@/features/notifications/api"

type State = "checking" | "success" | "error" | "missing"

/**
 * Landing page for the sender-email verification link. Consumes the one-shot
 * token via `verifySender` (auth-guarded, no shop header) and reports the
 * result. Resending lives on the sender card in Settings → Notifications.
 */
export default function VerifySenderPage() {
  const t = useTranslations("notifications")
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<State>(token ? "checking" : "missing")
  const [verifySender] = useMutation(VERIFY_SENDER)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await verifySender({ variables: { token } })
        if (cancelled) return
        setState(
          (data as { verifySender?: { success?: boolean } })?.verifySender
            ?.success
            ? "success"
            : "error",
        )
      } catch {
        if (!cancelled) setState("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, verifySender])

  if (state === "checking") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("console.verifyChecking")}
      </p>
    )
  }

  const success = state === "success"
  return (
    <div className="flex flex-col gap-4">
      <AuthHeading
        eyebrow={t("console.verifyEyebrow")}
        title={
          success ? t("console.verifySuccessTitle") : t("console.verifyErrorTitle")
        }
        description={
          success ? t("console.verifySuccessDesc") : t("console.verifyErrorDesc")
        }
      />
      <Button variant="outline" nativeButton={false} render={<Link href="/store" />}>
        {t("console.verifyBackToDashboard")}
      </Button>
    </div>
  )
}
