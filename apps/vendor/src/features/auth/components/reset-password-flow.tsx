"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { AuthInput, AuthOtpGroup, AuthOtpSlot, AuthSubmit } from "@repo/ui/components/auth-form"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { InputOTP } from "@repo/ui/components/input-otp"
import { useOtpAutoSubmit } from "@repo/ui/hooks/use-otp-auto-submit"
import { RESET_PASSWORD } from "@/features/auth/api"
import { resetCodeLength, useForgetPassword } from "@/features/auth/lib/send-code"
import type { ResetPasswordResponse } from "@/features/auth/types"
import {
  getRemainingCooldownSeconds,
  startCooldown,
} from "@/shared/lib/auth/cooldown"
import { applyValidationErrors, getErrorCode } from "@/shared/lib/auth/graphql-errors"
import {
  OTP_CODE_LENGTH,
  newPasswordSchema,
  verifyOtpSchemaFor,
  type NewPasswordInput,
  type VerifyOtpInput,
} from "@/features/auth/validations/auth"
import { useAuthStore } from "@/shared/stores/auth"
import { sileo } from "sileo"

function cooldownKey(identifier: string) {
  return `password-reset:${identifier.trim().toLowerCase()}`
}

const OTP_FIELD_MESSAGES = [
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_ALREADY_USED",
  "OTP_LOCKED",
] as const

/**
 * Step 2 of forgot-password: the code only, in as many boxes as the send said
 * it has (`codeLength`, 4 to 8). Verification happens atomically inside
 * `resetPassword` on the next screen — this step just collects the code so
 * the password form never shows it.
 */
export function ResetCodeStep({
  identifier,
  codeLength = OTP_CODE_LENGTH.fallback,
  defaultCode = "",
  error,
  onCodeLength,
  onVerified,
}: {
  identifier: string
  codeLength?: number
  defaultCode?: string
  error?: string | null
  /** A resend answered with a code of another length. */
  onCodeLength?: (codeLength: number) => void
  onVerified: (code: string) => void
}) {
  const t = useTranslations("auth")
  const tv = useTranslations("auth.validation")
  const [cooldown, setCooldown] = useState(() =>
    getRemainingCooldownSeconds(cooldownKey(identifier)),
  )

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VerifyOtpInput>({
    resolver: zodResolver(verifyOtpSchemaFor(codeLength, tv)),
    defaultValues: { code: defaultCode },
  })

  const [forgetPassword, { loading: resending }] = useForgetPassword()
  const { onCodeChange, submitOnce } = useOtpAutoSubmit(codeLength)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldown(getRemainingCooldownSeconds(cooldownKey(identifier)))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [identifier])

  const go = (code: string) =>
    submitOnce(async () => {
      onVerified(code)
    })

  const handleResend = async () => {
    try {
      const sent = await forgetPassword(identifier)

      if (sent.success) {
        startCooldown(cooldownKey(identifier), 60)
        setCooldown(60)
        if (sent.codeLength !== codeLength) {
          setValue("code", "")
          onCodeLength?.(sent.codeLength)
        }
        sileo.success({ title: t("resetPassword.newCodeSent") })
      }
    } catch (err) {
      if (getErrorCode(err) === "OTP_COOLDOWN") {
        startCooldown(cooldownKey(identifier), 60)
        setCooldown(60)
      }
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit((data) => void go(data.code))}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <AuthHeading
          eyebrow={t("resetPassword.eyebrow")}
          title={t("resetPassword.title")}
          description={t.rich("resetPassword.subtitle", {
            identifier,
            length: codeLength,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        />
        <Field>
          <FieldLabel htmlFor="code">{t("resetPassword.resetCode")}</FieldLabel>
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <InputOTP
                id="code"
                maxLength={codeLength}
                autoComplete="one-time-code"
                containerClassName="justify-center"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  onCodeChange(value, () => {
                    void go(value)
                  })
                }}
                onBlur={field.onBlur}
              >
                <AuthOtpGroup>
                  {Array.from({ length: codeLength }, (_, index) => (
                    <AuthOtpSlot key={index} index={index} />
                  ))}
                </AuthOtpGroup>
              </InputOTP>
            )}
          />
          <FieldError
            className="text-center"
            errors={[errors.code, error ? { message: error } : undefined]}
          />
          <p className="text-center text-xs text-muted-foreground">
            {t("codeExpiresIn")}
          </p>
        </Field>
        <Field>
          <AuthSubmit>{t("resetPassword.continue")}</AuthSubmit>
        </Field>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {t("didntReceiveCode")}{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : resending
                ? t("sending")
                : t("resend")}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}

/**
 * Step 3 of forgot-password: new password + confirm only. The OTP lives on
 * `ResetCodeStep` and is passed in, never rendered here.
 */
export function ResetPasswordFields({
  identifier,
  code,
  onBack,
  onOtpRejected,
}: {
  identifier: string
  code: string
  onBack: () => void
  onOtpRejected: (message: string) => void
}) {
  const t = useTranslations("auth")
  const tv = useTranslations("auth.validation")
  const router = useRouter()
  const apollo = useApolloClient()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema(tv)),
    defaultValues: { password: "", password_confirmation: "" },
  })

  const [resetPassword, { loading }] =
    useMutation<ResetPasswordResponse>(RESET_PASSWORD)

  const onSubmit = async (data: NewPasswordInput) => {
    try {
      const { data: result } = await resetPassword({
        variables: {
          input: {
            identifier,
            code,
            password: data.password,
            password_confirmation: data.password_confirmation,
          },
        },
      })

      if (result?.resetPassword?.success) {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          })
        } catch {
          // Backend already revoked all refresh tokens — local cleanup is what matters.
        }
        useAuthStore.getState().clearTokens()
        try {
          await apollo.clearStore()
        } catch {
          // clearStore rejects if no active queries; safe to ignore.
        }
        sileo.success({
          title: t("resetPassword.passwordReset"),
          description: t("resetPassword.passwordResetDesc"),
        })
        router.push("/login")
      }
    } catch (err) {
      const errorCode = getErrorCode(err)

      const otpMessages: Record<(typeof OTP_FIELD_MESSAGES)[number], string> = {
        OTP_INVALID: t("resetPassword.codeInvalid"),
        OTP_EXPIRED: t("resetPassword.codeExpired"),
        OTP_ALREADY_USED: t("resetPassword.codeUsed"),
        OTP_LOCKED: t("resetPassword.codeLocked"),
      }

      if (errorCode && OTP_FIELD_MESSAGES.includes(errorCode as (typeof OTP_FIELD_MESSAGES)[number])) {
        onOtpRejected(otpMessages[errorCode as (typeof OTP_FIELD_MESSAGES)[number]])
        return
      }

      applyValidationErrors(err, setError, ["password", "password_confirmation"])
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <AuthHeading
          eyebrow={t("resetPassword.eyebrow")}
          title={t("resetPassword.passwordTitle")}
          description={t("resetPassword.passwordSubtitle")}
        />
        <Field>
          <FieldLabel htmlFor="password">{t("newPassword")}</FieldLabel>
          <AuthInput
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </Field>
        <Field>
          <FieldLabel htmlFor="password_confirmation">
            {t("confirmPassword")}
          </FieldLabel>
          <AuthInput
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            {...register("password_confirmation")}
          />
          <FieldError errors={[errors.password_confirmation]} />
        </Field>
        <Field>
          <AuthSubmit disabled={loading}>
            {loading ? t("resetPassword.resetting") : t("resetPassword.reset")}
          </AuthSubmit>
        </Field>
        <p className="text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onBack}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("resetPassword.backToCode")}
          </button>
        </p>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}

export function ResetPasswordFlow() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const identifier = searchParams.get("identifier") ?? ""
  // Held here, not in the code step, so coming back from the password step
  // keeps a length a resend changed.
  const [codeLength, setCodeLength] = useState(() => resetCodeLength(searchParams))
  const [step, setStep] = useState<"code" | "password">("code")
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)

  if (!identifier) {
    return (
      <div className="flex flex-col gap-4">
        <AuthHeading
          eyebrow={t("resetPassword.eyebrow")}
          title={t("resetPassword.missingTitle")}
          description={t("resetPassword.missingDesc")}
        />
        <Link
          href="/forgot-password"
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          {t("resetPassword.requestResetCode")}
        </Link>
      </div>
    )
  }

  if (step === "password") {
    return (
      <ResetPasswordFields
        identifier={identifier}
        code={code}
        onBack={() => setStep("code")}
        onOtpRejected={(message) => {
          setCodeError(message)
          setStep("code")
        }}
      />
    )
  }

  return (
    <ResetCodeStep
      identifier={identifier}
      codeLength={codeLength}
      defaultCode={code}
      error={codeError}
      onCodeLength={(next) => {
        setCodeLength(next)
        setCode("")
      }}
      onVerified={(next) => {
        setCode(next)
        setCodeError(null)
        setStep("password")
      }}
    />
  )
}

export default ResetPasswordFlow
