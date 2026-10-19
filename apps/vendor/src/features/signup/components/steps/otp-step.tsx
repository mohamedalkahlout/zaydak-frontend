"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"

import { AuthHeading } from "@repo/ui/components/auth-heading"
import {
  AuthOtpGroup,
  AuthOtpSlot,
  AuthSubmit,
} from "@repo/ui/components/auth-form"
import { FieldError } from "@repo/ui/components/field"
import { InputOTP } from "@repo/ui/components/input-otp"
import { useOtpAutoSubmit } from "@repo/ui/hooks/use-otp-auto-submit"

import { RESEND_VENDOR_SIGNUP_OTP, VERIFY_VENDOR_SIGNUP_OTP } from "../../api"
import type {
  ResendVendorSignupOtpResponse,
  SignupDraftData,
  VerifyVendorSignupOtpResponse,
} from "../../types"
import { signupOtpSchemaFor, type SignupOtpInput } from "../../validations/signup"
import { getErrorCode } from "@/shared/lib/auth/graphql-errors"

/**
 * Step 3. The number of slots comes from the draft, not from a constant: an
 * admin sets the code length from the console, and a form asking for six digits
 * when four were sent can never be completed.
 */
export function OtpStep({
  draft,
  onVerified,
  onDraftRefreshed,
  onBack,
}: {
  draft: SignupDraftData
  onVerified: (draft: SignupDraftData) => void
  /** A resend rotates the token; the wizard has to keep the newest one. */
  onDraftRefreshed: (draft: SignupDraftData) => void
  onBack: () => void
}) {
  const t = useTranslations("signup")
  const tv = useTranslations("signup.validation")
  const [cooldown, setCooldown] = useState(draft.resend_after)

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupOtpInput>({
    resolver: zodResolver(signupOtpSchemaFor(draft.code_length, tv)),
    defaultValues: { code: "" },
  })

  const [verify, { loading }] =
    useMutation<VerifyVendorSignupOtpResponse>(VERIFY_VENDOR_SIGNUP_OTP)
  const [resend, { loading: resending }] =
    useMutation<ResendVendorSignupOtpResponse>(RESEND_VENDOR_SIGNUP_OTP)
  const { onCodeChange, submitOnce } = useOtpAutoSubmit(draft.code_length)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  const onSubmit = async (values: SignupOtpInput) => {
    await submitOnce(async () => {
      try {
        const { data } = await verify({
          variables: { input: { token: draft.signup_token, code: values.code } },
        })

        const verified = data?.verifyVendorSignupOtp?.data
        if (verified) onVerified(verified)
      } catch (err) {
        const code = getErrorCode(err)

        if (code === "OTP_INVALID") {
          setError("code", { type: "server", message: t("otp.incorrect") })
          return
        }
        if (code === "OTP_EXPIRED") {
          setError("code", { type: "server", message: t("otp.expired") })
          return
        }
        if (code === "OTP_LOCKED") {
          setError("code", { type: "server", message: t("otp.locked") })
          return
        }
        // The draft outlives neither of these — the vendor has to start over.
        if (code === "SIGNUP_TOKEN_EXPIRED" || code === "SIGNUP_TOKEN_INVALID") {
          setError("code", { type: "server", message: t("otp.sessionExpired") })
        }
      }
    })
  }

  const handleResend = async () => {
    try {
      const { data } = await resend({ variables: { token: draft.signup_token } })
      const refreshed = data?.resendVendorSignupOtp?.data
      if (refreshed) {
        onDraftRefreshed(refreshed)
        setCooldown(refreshed.resend_after)
      }
    } catch (err) {
      // The server's cooldown is the real one; mirror it into the timer so the
      // button stops inviting a retry it will refuse.
      if (getErrorCode(err) === "OTP_COOLDOWN") setCooldown(60)
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthHeading
        className="mb-6"
        title={t("otp.title")}
        // The channel is an admin setting, so the sentence is chosen from what
        // the server says it did — a hardcoded "to your phone" would be a lie
        // the moment the console is switched to email.
        description={t(`otp.sentTo.${draft.channel}`, {
          destination: draft.destination_masked,
        })}
      />

      <div className="space-y-4">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <InputOTP
              maxLength={draft.code_length}
              autoComplete="one-time-code"
              autoFocus
              disabled={loading}
              containerClassName="justify-center"
              value={field.value}
              onChange={(value) => {
                field.onChange(value)
                onCodeChange(value, () => {
                  void onSubmit({ code: value })
                })
              }}
              onBlur={field.onBlur}
            >
              <AuthOtpGroup>
                {Array.from({ length: draft.code_length }, (_, i) => i).map((index) => (
                  <AuthOtpSlot key={index} index={index} />
                ))}
              </AuthOtpGroup>
            </InputOTP>
          )}
        />

        <FieldError className="text-center" errors={[errors.code]} />

        <p className="text-center text-sm text-muted-foreground">
          {t("otp.didntReceive")}{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="font-medium text-foreground underline underline-offset-4 disabled:text-muted-foreground/60 disabled:no-underline"
          >
            {cooldown > 0
              ? t("otp.resendIn", { seconds: cooldown })
              : resending
                ? t("sending")
                : t("otp.resend")}
          </button>
        </p>

        <AuthSubmit disabled={loading}>
          {loading ? t("otp.verifying") : t("otp.verify")}
        </AuthSubmit>

        <p className="text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("back")}
          </button>
        </p>
      </div>
    </form>
  )
}
