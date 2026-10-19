"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import {
  AuthInput,
  AuthOtpGroup,
  AuthOtpSlot,
  AuthSubmit,
} from "@repo/ui/components/auth-form"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field"
import { InputOTP } from "@repo/ui/components/input-otp"
import { useOtpAutoSubmit } from "@repo/ui/hooks/use-otp-auto-submit"

import { VERIFY_OTP_CODE } from "@/features/auth/api"
import { useSendOtpCode } from "@/features/auth/lib/send-code"
import {
  OTP_CODE_LENGTH,
  sendOtpSchema,
  verifyOtpSchemaFor,
  type SendOtpInput,
  type VerifyOtpInput,
} from "@/features/auth/validations"
import { getRemainingCooldownSeconds, startCooldown } from "@/shared/auth/cooldown"
import { applyValidationErrors, getErrorCode } from "@/shared/auth/graphql-errors"
import { isAdminRole } from "@/shared/auth/roles"
import { useAuthStore } from "@/shared/stores/auth"

function otpCooldownKey(identifier: string) {
  return `login-otp:${identifier.trim().toLowerCase()}`
}

export default function OtpLoginPage() {
  const [step, setStep] = useState<"request" | "verify">("request")
  const [identifier, setIdentifier] = useState("")
  // What the last send said the code has — 4 to 8 digits, or a Verify
  // service's own length. Six until a send answers.
  const [codeLength, setCodeLength] = useState<number>(OTP_CODE_LENGTH.fallback)

  return step === "request" ? (
    <RequestStep
      onSent={(id, length) => {
        setIdentifier(id)
        setCodeLength(length)
        setStep("verify")
      }}
    />
  ) : (
    <VerifyStep
      identifier={identifier}
      codeLength={codeLength}
      onResent={setCodeLength}
      onBack={() => setStep("request")}
    />
  )
}

function RequestStep({
  onSent,
}: {
  onSent: (identifier: string, codeLength: number) => void
}) {
  const t = useTranslations("auth")
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SendOtpInput>({ resolver: zodResolver(sendOtpSchema) })

  const [sendOtp, { loading }] = useSendOtpCode()

  const onSubmit = async (data: SendOtpInput) => {
    try {
      const sent = await sendOtp(data.identifier)
      if (!sent.success) return

      startCooldown(otpCooldownKey(data.identifier), 60)
      sileo.success({ title: t("verifyOtp.codeSent") })
      onSent(data.identifier, sent.codeLength)
    } catch (err) {
      if (getErrorCode(err) === "OTP_COOLDOWN") {
        startCooldown(otpCooldownKey(data.identifier), 60)
      }
      // A number nobody proved on its account gets no code — the email still
      // signs in.
      if (getErrorCode(err) === "PHONE_NOT_CONFIRMED") {
        setError("identifier", {
          type: "server",
          message: t("verifyOtp.phoneNotConfirmed"),
        })
        return
      }
      applyValidationErrors(err, setError, ["identifier"])
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <AuthHeading
          eyebrow={t("verifyOtp.eyebrow")}
          title={t("verifyOtp.title")}
          description={t("verifyOtp.subtitle")}
        />
        <Field>
          <FieldLabel htmlFor="identifier">{t("emailOrPhone")}</FieldLabel>
          <AuthInput
            id="identifier"
            dir="ltr"
            placeholder={t("emailOrPhonePlaceholder")}
            autoComplete="username"
            {...register("identifier")}
          />
          <FieldError errors={[errors.identifier]} />
        </Field>
        <Field>
          <AuthSubmit disabled={loading}>
            {loading ? t("sending") : t("verifyOtp.sendCode")}
          </AuthSubmit>
        </Field>
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

function VerifyStep({
  identifier,
  codeLength,
  onResent,
  onBack,
}: {
  identifier: string
  codeLength: number
  onResent: (codeLength: number) => void
  onBack: () => void
}) {
  const t = useTranslations("auth")
  const router = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [cooldown, setCooldown] = useState(() =>
    getRemainingCooldownSeconds(otpCooldownKey(identifier)),
  )

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<VerifyOtpInput>({
    // Rebuilt each render: `useForm` reads the latest resolver, so a resend
    // that changes the length changes what Verify accepts.
    resolver: zodResolver(verifyOtpSchemaFor(codeLength)),
    defaultValues: { code: "" },
  })

  const [verifyOtp, { loading }] = useMutation(VERIFY_OTP_CODE)
  const [sendOtp, { loading: resending }] = useSendOtpCode()
  const { onCodeChange, submitOnce } = useOtpAutoSubmit(codeLength)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldown(getRemainingCooldownSeconds(otpCooldownKey(identifier)))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [identifier])

  const onSubmit = async (data: VerifyOtpInput) => {
    await submitOnce(async () => {
      try {
        const { data: result } = await verifyOtp({
          variables: { input: { identifier, code: data.code } },
        })
        if (!result?.verifyOtpCode?.success || !result.verifyOtpCode.data) return

        // Same gate as the password login: reject before the session is written.
        if (!isAdminRole(result.verifyOtpCode.data.role)) {
          setError("code", { type: "server", message: t("notAdmin") })
          return
        }

        await setTokens(result.verifyOtpCode.data)
        sileo.success({ title: t("verifyOtp.signedIn") })
        router.push("/users")
      } catch (err) {
        const code = getErrorCode(err)

        if (code === "OTP_INVALID") {
          setError("code", { type: "server", message: t("verifyOtp.incorrectCode") })
          return
        }
        if (code === "OTP_EXPIRED") {
          setError("code", { type: "server", message: t("verifyOtp.codeExpired") })
          return
        }
        if (code === "OTP_LOCKED") {
          setError("code", { type: "server", message: t("verifyOtp.codeLocked") })
          return
        }
        if (code === "PHONE_NOT_CONFIRMED") {
          setError("code", {
            type: "server",
            message: t("verifyOtp.phoneNotConfirmed"),
          })
          return
        }

        if (err instanceof Error && err.message === "Failed to persist session") {
          sileo.error({
            title: t("sessionFailed"),
          })
        }
      }
    })
  }

  const handleResend = async () => {
    try {
      const sent = await sendOtp(identifier)
      if (!sent.success) return

      startCooldown(otpCooldownKey(identifier), 60)
      setCooldown(60)
      // Digits typed for the old code are no use against a new one of
      // another length.
      if (sent.codeLength !== codeLength) {
        setValue("code", "")
        onResent(sent.codeLength)
      }
      sileo.success({ title: t("verifyOtp.codeResent") })
    } catch (err) {
      if (getErrorCode(err) === "OTP_COOLDOWN") {
        startCooldown(otpCooldownKey(identifier), 60)
        setCooldown(60)
      }
      if (getErrorCode(err) === "PHONE_NOT_CONFIRMED") {
        sileo.error({ title: t("verifyOtp.phoneNotConfirmed") })
      }
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <AuthHeading
          eyebrow={t("verifyOtp.eyebrow")}
          title={t("verifyOtp.verifyTitle")}
          description={t.rich("verifyOtp.verifySubtitle", {
            identifier,
            length: codeLength,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        />
        <Field>
          <FieldLabel htmlFor="code">{t("verifyOtp.verificationCode")}</FieldLabel>
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <InputOTP
                id="code"
                maxLength={codeLength}
                autoComplete="one-time-code"
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
                  {Array.from({ length: codeLength }, (_, i) => (
                    <AuthOtpSlot key={i} index={i} />
                  ))}
                </AuthOtpGroup>
              </InputOTP>
            )}
          />
          <FieldError className="text-center" errors={[errors.code]} />
          <p className="text-xs text-muted-foreground text-center">
            {t("codeExpiresIn")}
          </p>
        </Field>
        <Field>
          <AuthSubmit disabled={loading}>
            {loading ? t("verifyOtp.verifying") : t("verifyOtp.verify")}
          </AuthSubmit>
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
          <button
            type="button"
            onClick={onBack}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("verifyOtp.useOther")}
          </button>
        </p>
      </FieldGroup>
    </form>
  )
}
