"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { ChevronLeftIcon } from "lucide-react"

import {
  AuthInput,
  AuthOtpGroup,
  AuthOtpSlot,
  AuthSubmit,
} from "@repo/ui/components/auth-form"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import { AuthShell } from "@repo/ui/components/auth-shell"
import { Button } from "@repo/ui/components/button"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { InputOTP } from "@repo/ui/components/input-otp"
import { useOtpAutoSubmit } from "@repo/ui/hooks/use-otp-auto-submit"

// Imported per file rather than through the feature barrel so this route does
// not pull the four signup panes into its bundle for a screen that creates
// nothing.
import { SignupBrand } from "@/features/signup/components/signup-brand"
import { LocaleSwitcher } from "@/shared/components/locale-switcher"
import {
  getRemainingCooldownSeconds,
  startCooldown,
} from "@/shared/lib/auth/cooldown"
import {
  applyValidationErrors,
  getErrorCode,
} from "@/shared/lib/auth/graphql-errors"
import { useAuthStore } from "@/shared/stores/auth"

import { clearSignupProgress } from "@/features/signup/lib/progress"
import { useDiscardSignupProgress } from "@/features/signup/lib/use-discard-signup-progress"

import { VERIFY_OTP_CODE } from "../api"
import { completeVendorSignIn } from "../lib/complete-vendor-sign-in"
import { useSendOtpCode } from "../lib/send-code"
import type { VerifyOtpResponse } from "../types"
import {
  OTP_CODE_LENGTH,
  sendOtpSchema,
  verifyOtpSchemaFor,
  type SendOtpInput,
  type VerifyOtpInput,
} from "../validations/auth"

function otpCooldownKey(identifier: string) {
  return `login-otp:${identifier.trim().toLowerCase()}`
}

/**
 * Passwordless sign-in behind `/verify-otp`: say where the code should go, then
 * type it in.
 *
 * It wears `AuthShell` — the same frame as `/login`, with the same layout
 * slots — because it *is* a sign-in; only the card's question differs. It
 * stays outside the `(auth)` group so the URL keeps its history and
 * `proxy.ts` needed no edit; the shell props are passed here instead of by a
 * layout.
 */
export function CodeSignIn() {
  const t = useTranslations("auth")
  const [pane, setPane] = useState<"identifier" | "code">("identifier")
  const [identifier, setIdentifier] = useState("")
  // What the last send said the code has — an admin sets 4 to 8 digits, and
  // a Verify service has its own. Six until a send answers.
  const [codeLength, setCodeLength] = useState<number>(OTP_CODE_LENGTH.fallback)
  useDiscardSignupProgress()

  return (
    <AuthShell
      brand={<SignupBrand />}
      eyebrow={t("layout.eyebrow")}
      headline={t("layout.headline")}
      quote={t("layout.quote")}
      chips={[
        t("layout.chipCatalog"),
        t("layout.chipPayments"),
        t("layout.chipReports"),
      ]}
      backLink={
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          {/* The chevron points back the way the reader came, either direction. */}
          <ChevronLeftIcon className="size-4 rtl:rotate-180" />
          {t("backToSignIn")}
        </Button>
      }
      toolbar={<LocaleSwitcher variant="labeled" />}
    >
      {pane === "identifier" ? (
        <IdentifierPane
          defaultIdentifier={identifier}
          onSent={(value, length) => {
            setIdentifier(value)
            setCodeLength(length)
            setPane("code")
          }}
        />
      ) : (
        <CodePane
          identifier={identifier}
          codeLength={codeLength}
          onResent={setCodeLength}
          onBack={() => setPane("identifier")}
        />
      )}

      <p className="pt-6 text-center text-xs text-zinc-500">{t("terms")}</p>
    </AuthShell>
  )
}

function IdentifierPane({
  defaultIdentifier,
  onSent,
}: {
  defaultIdentifier: string
  onSent: (identifier: string, codeLength: number) => void
}) {
  const t = useTranslations("auth")
  const tv = useTranslations("auth.validation")

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SendOtpInput>({
    resolver: zodResolver(sendOtpSchema(tv)),
    defaultValues: { identifier: defaultIdentifier },
  })

  const [sendOtp, { loading }] = useSendOtpCode()

  const onSubmit = async (data: SendOtpInput) => {
    try {
      const sent = await sendOtp(data.identifier)

      if (sent.success) {
        startCooldown(otpCooldownKey(data.identifier), 60)
        sileo.success({ title: t("verifyOtp.codeSent") })
        onSent(data.identifier, sent.codeLength)
      }
    } catch (err) {
      // The server's cooldown is the real one; mirror it so the next pane's
      // resend button does not invite a retry it will refuse.
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
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthHeading
        className="mb-6"
        title={t("verifyOtp.title")}
        description={t("verifyOtp.subtitle")}
      />

      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="identifier">{t("emailOrPhone")}</FieldLabel>
          <AuthInput
            id="identifier"
            dir="ltr"
            autoComplete="username"
            autoFocus
            placeholder={t("emailOrPhonePlaceholder")}
            aria-invalid={!!errors.identifier || undefined}
            {...register("identifier")}
          />
          <FieldError errors={[errors.identifier]} />
        </Field>

        <AuthSubmit disabled={loading}>
          {loading ? t("sending") : t("verifyOtp.sendCode")}
        </AuthSubmit>

        <p className="text-center text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link
            href="/register"
            onClick={clearSignupProgress}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {t("signUp")}
          </Link>
        </p>
      </div>
    </form>
  )
}

function CodePane({
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
  const tv = useTranslations("auth.validation")
  const tStore = useTranslations("createStore")
  const router = useRouter()
  const client = useApolloClient()
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
    resolver: zodResolver(verifyOtpSchemaFor(codeLength, tv)),
    defaultValues: { code: "" },
  })

  const [verifyOtp, { loading }] = useMutation<VerifyOtpResponse>(VERIFY_OTP_CODE)
  const [sendOtp, { loading: resending }] = useSendOtpCode()
  // Last slot filled → same `onSubmit` as Verify. Latch + in-flight lock
  // stop a paste and a click from sending the mutation twice.
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
          variables: {
            input: { identifier, code: data.code },
          },
          ...(process.env.NODE_ENV !== "production" && {
            context: { headers: { "x-debug-mode": "1" } },
          }),
        })

        if (result?.verifyOtpCode?.success) {
          await setTokens(result.verifyOtpCode.data)

          sileo.success({
            title: t("verifyOtp.signedIn"),
            description:
              result.verifyOtpCode.data.email_verified === false
                ? t("verifyOtp.emailNotVerified")
                : undefined,
          })

          const dest = await completeVendorSignIn({
            client,
            temporaryName: tStore("temporaryName"),
            redirect: null,
          })
          router.push(dest)
        }
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
        }
      }
    })
  }

  const handleResend = async () => {
    try {
      const sent = await sendOtp(identifier)

      if (sent.success) {
        startCooldown(otpCooldownKey(identifier), 60)
        setCooldown(60)
        // Digits typed for the old code are no use against a new one of
        // another length.
        if (sent.codeLength !== codeLength) {
          setValue("code", "")
          onResent(sent.codeLength)
        }
        sileo.success({ title: t("verifyOtp.codeResent") })
      }
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
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthHeading
        className="mb-6"
        title={t("verifyOtp.verifyTitle")}
        description={t.rich("verifyOtp.verifySubtitle", {
          identifier,
          length: codeLength,
          strong: (chunks) => (
            <strong className="font-semibold text-foreground" dir="ltr">
              {chunks}
            </strong>
          ),
        })}
      />

      <div className="space-y-4">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <InputOTP
              maxLength={codeLength}
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
                {Array.from({ length: codeLength }, (_, index) => (
                  <AuthOtpSlot key={index} index={index} />
                ))}
              </AuthOtpGroup>
            </InputOTP>
          )}
        />

        <div className="space-y-1 text-center">
          <FieldError className="text-center" errors={[errors.code]} />
          <p className="text-xs text-muted-foreground">{t("codeExpiresIn")}</p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("didntReceiveCode")}{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="font-medium text-foreground underline underline-offset-4 disabled:text-muted-foreground/60 disabled:no-underline"
          >
            {cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : resending
                ? t("sending")
                : t("resend")}
          </button>
        </p>

        <AuthSubmit disabled={loading}>
          {loading ? t("verifyOtp.verifying") : t("verifyOtp.verify")}
        </AuthSubmit>

        <p className="text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("verifyOtp.useOther")}
          </button>
        </p>
      </div>
    </form>
  )
}
