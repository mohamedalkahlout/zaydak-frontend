"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { z } from "zod"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/ui/components/input-otp"
import { Label } from "@repo/ui/components/label"
import { useOtpAutoSubmit } from "@repo/ui/hooks/use-otp-auto-submit"
import { cn } from "@repo/ui/lib/utils"

import { getErrorCode, getValidationErrors } from "@/shared/auth/graphql-errors"
import { useAuthStore } from "@/shared/stores/auth"
import { useShop } from "@/features/shop/shop-context"
import {
  SEND_SIGN_IN_CODE,
  UPDATE_MY_PROFILE,
  VERIFY_SIGN_IN_CODE,
} from "../api"
import { completeSignIn, finishSignIn } from "../lib/complete-sign-in"
import {
  getRemainingCooldownSeconds,
  rememberCodeLength,
  rememberedCodeLength,
  startCooldown,
} from "../lib/cooldown"
import type { AuthChromeProps } from "../lib/auth-chrome"
import { AuthCard } from "./auth-card"

/** Until the server says otherwise, the OTP settings' defaults. */
const DEFAULT_CODE_LENGTH = 6
const DEFAULT_RESEND_SECONDS = 60
const DEFAULT_EXPIRES_SECONDS = 300

type Pane = "phone" | "code" | "details"

/** A code that went out, and what the code pane needs to know about it. */
interface SentCode {
  /**
   * The number to verify against: the server's E.164 reading when it sent
   * one, else what was typed — the server reads it the same way both times.
   */
  phone: string
  codeLength: number
  resendAfter: number
  expiresIn: number
}

const phoneSchema = z.object({
  phone: z.string().trim().min(3).max(32),
})

const detailsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]),
})

type PhoneValues = z.infer<typeof phoneSchema>
type DetailsValues = z.infer<typeof detailsSchema>

function cooldownKey(phone: string) {
  return `storefront-sign-in:${phone.replace(/[^\d+]/g, "")}`
}

/**
 * Signing in to this shop: a phone number, then the code texted to it.
 *
 * **The only way a customer signs in.** No password, no email, no separate
 * sign-up: a number the code proves is this shop's customer — signed in if
 * the shop has one on it, made if not — and a new customer is then asked for
 * a name (and, optionally, an email for receipts). Vendors and admins never
 * sign in here; a number that also sits on a merchant's account is simply a
 * customer of this shop.
 */
export function LoginForm({
  variant = "page",
  redirect: redirectOverride,
}: AuthChromeProps = {}) {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const { slug, shop } = useShop()

  const [pane, setPane] = useState<Pane>("phone")
  const [typed, setTyped] = useState("")
  const [sent, setSent] = useState<SentCode | null>(null)

  const expired = searchParams.has("expired")
  useEffect(() => {
    if (expired) sileo.info({ title: t("expired") })
  }, [expired, t])

  // The popup knows where the shopper is standing; a route only knows what
  // the guard wrote into the URL.
  const redirect = redirectOverride ?? searchParams.get("redirect")
  const shopName = shop?.name ?? slug

  const [title, subtitle] =
    pane === "code"
      ? [
          t("codeTitle"),
          t("codeSubtitle", {
            length: sent?.codeLength ?? DEFAULT_CODE_LENGTH,
          }),
        ]
      : pane === "details"
        ? [t("detailsTitle"), t("detailsSubtitle", { shop: shopName })]
        : [t("signInTitle"), t("signInSubtitle", { shop: shopName })]

  return (
    <AuthCard title={title} subtitle={subtitle} variant={variant}>
      {pane === "phone" ? (
        <PhonePane
          defaultPhone={typed}
          lastCodeLength={sent?.codeLength}
          onSent={(value, code) => {
            setTyped(value)
            setSent(code)
            setPane("code")
          }}
        />
      ) : pane === "code" && sent ? (
        <CodePane
          sent={sent}
          typed={typed}
          redirect={redirect}
          onResent={setSent}
          onNewCustomer={() => setPane("details")}
          onBack={() => setPane("phone")}
        />
      ) : (
        <DetailsPane redirect={redirect} />
      )}
    </AuthCard>
  )
}

function PhonePane({
  defaultPhone,
  lastCodeLength,
  onSent,
}: {
  defaultPhone: string
  /** What the last send on this screen said the code has. */
  lastCodeLength?: number
  onSent: (typed: string, code: SentCode) => void
}) {
  const t = useTranslations("auth")

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: defaultPhone },
  })

  const [sendCode, { loading }] = useMutation(SEND_SIGN_IN_CODE)

  async function onSubmit(values: PhoneValues) {
    try {
      const result = await sendCode({
        variables: { input: { phone: values.phone } },
        context: { headers: { authorization: "" } },
      })
      const data = result.data?.sendCustomerSignInCode.data
      if (!data) {
        sileo.error({ title: t("genericError") })
        return
      }
      startCooldown(cooldownKey(data.phone_e164), data.resend_after_seconds)
      rememberCodeLength(data.code_length)
      sileo.success({ title: t("otpCodeSent") })
      onSent(values.phone, {
        phone: data.phone_e164,
        codeLength: data.code_length,
        resendAfter: data.resend_after_seconds,
        expiresIn: data.expires_in_seconds,
      })
    } catch (error) {
      const code = getErrorCode(error)
      if (code === "INVALID_PHONE_FORMAT" || code === "VALIDATION_ERROR") {
        setError("phone", { type: "server", message: t("phoneInvalid") })
        return
      }
      if (code === "OTP_COOLDOWN") {
        // A code went out a moment ago: it is still the one to type. The
        // refusal says nothing about it, so its length is the one the last
        // send announced — here, or before a reload — and only then the
        // default.
        startCooldown(cooldownKey(values.phone), DEFAULT_RESEND_SECONDS)
        sileo.info({ title: t("otpCooldown") })
        onSent(values.phone, {
          phone: values.phone,
          codeLength:
            lastCodeLength ?? rememberedCodeLength() ?? DEFAULT_CODE_LENGTH,
          resendAfter: DEFAULT_RESEND_SECONDS,
          expiresIn: DEFAULT_EXPIRES_SECONDS,
        })
        return
      }
      sileo.error({ title: t(errorKey(code)) })
    }
  }

  return (
    <form
      method="post"
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone" className="text-xs font-medium">
          {t("phone")}
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          autoFocus
          aria-invalid={!!errors.phone}
          aria-describedby="phone-hint"
          className="h-11 rounded-xl border-shop-hairline"
          {...register("phone")}
        />
        {errors.phone ? (
          <p className="text-xs text-destructive">
            {errors.phone.message ?? t("phoneInvalid")}
          </p>
        ) : (
          <p id="phone-hint" className="text-xs text-muted-foreground">
            {t("phoneHint")}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-11 w-full rounded-full bg-shop-accent text-base text-shop-accent-foreground hover:bg-shop-accent/90"
        disabled={loading}
      >
        {loading ? t("sendingCode") : t("sendCode")}
      </Button>
    </form>
  )
}

function CodePane({
  sent,
  typed,
  redirect,
  onResent,
  onNewCustomer,
  onBack,
}: {
  sent: SentCode
  typed: string
  redirect: string | null
  onResent: (code: SentCode) => void
  onNewCustomer: () => void
  onBack: () => void
}) {
  const t = useTranslations("auth")
  const { slug, base } = useShop()
  const client = useApolloClient()
  const key = cooldownKey(sent.phone)
  const [cooldown, setCooldown] = useState(() =>
    getRemainingCooldownSeconds(key),
  )

  const codeSchema = z.object({
    code: z
      .string()
      .length(sent.codeLength)
      .regex(/^\d+$/),
  })
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<{ code: string }>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  })

  const [verifyCode, { loading }] = useMutation(VERIFY_SIGN_IN_CODE)
  const [sendCode, { loading: resending }] = useMutation(SEND_SIGN_IN_CODE)
  const { onCodeChange, submitOnce } = useOtpAutoSubmit(sent.codeLength)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldown(getRemainingCooldownSeconds(key))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [key])

  async function onSubmit(values: { code: string }) {
    await submitOnce(async () => {
      try {
        const result = await verifyCode({
          variables: { input: { phone: sent.phone, code: values.code } },
          context: { headers: { authorization: "" } },
        })
        const data = result.data?.verifyCustomerSignInCode.data
        if (!data) {
          sileo.error({ title: t("genericError") })
          return
        }

        // A new customer, or one the shop knows by number alone: the session
        // is stored first so the name can be saved with it.
        if (!data.customer.name) {
          await useAuthStore.getState().setTokens(slug, data)
          onNewCustomer()
          return
        }
        sileo.success({ title: t("welcomeBack") })
        await completeSignIn({ slug, base, tokens: data, client, redirect })
      } catch (error) {
        const code = getErrorCode(error)
        const field = CODE_FIELD_ERRORS[code ?? ""]
        if (field) {
          setError("code", { type: "server", message: t(field) })
          return
        }
        if (code === "INVALID_PHONE_FORMAT") {
          onBack()
          return
        }
        sileo.error({ title: t(errorKey(code)) })
      }
    })
  }

  async function handleResend() {
    try {
      const result = await sendCode({
        variables: { input: { phone: sent.phone || typed } },
        context: { headers: { authorization: "" } },
      })
      const data = result.data?.sendCustomerSignInCode.data
      if (data) {
        startCooldown(key, data.resend_after_seconds)
        setCooldown(data.resend_after_seconds)
        rememberCodeLength(data.code_length)
        onResent({
          phone: data.phone_e164,
          codeLength: data.code_length,
          resendAfter: data.resend_after_seconds,
          expiresIn: data.expires_in_seconds,
        })
        sileo.success({ title: t("otpCodeResent") })
      }
    } catch (error) {
      const code = getErrorCode(error)
      if (code === "OTP_COOLDOWN") {
        startCooldown(key, sent.resendAfter)
        setCooldown(sent.resendAfter)
        return
      }
      sileo.error({ title: t(errorKey(code)) })
    }
  }

  return (
    <form
      method="post"
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <p className="text-center text-sm font-medium" dir="ltr">
        {sent.phone}
      </p>

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <InputOTP
            maxLength={sent.codeLength}
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
            <InputOTPGroup dir="ltr" className="gap-2">
              {Array.from({ length: sent.codeLength }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className={cn(
                    "size-11 rounded-xl border border-shop-hairline text-base first:rounded-xl last:rounded-xl",
                    errors.code && "border-destructive",
                  )}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        )}
      />

      <div className="space-y-1 text-center">
        {errors.code && (
          <p className="text-xs text-destructive">
            {errors.code.message ?? t("otpInvalid")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("codeExpiresIn", {
            minutes: Math.max(1, Math.round(sent.expiresIn / 60)),
          })}
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("didntReceiveCode")}{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="font-medium text-shop-accent underline-offset-4 hover:underline disabled:text-muted-foreground/60 disabled:no-underline"
        >
          {cooldown > 0
            ? t("resendIn", { seconds: cooldown })
            : resending
              ? t("sendingCode")
              : t("resend")}
        </button>
      </p>

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-11 w-full rounded-full bg-shop-accent text-base text-shop-accent-foreground hover:bg-shop-accent/90"
        disabled={loading}
      >
        {loading ? t("verifying") : t("verifyCode")}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="text-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {t("useOtherPhone")}
      </button>
    </form>
  )
}

/**
 * A new customer's name — the courier's label needs one — and, if they like,
 * an email for receipts. Skippable: the session already exists, and the
 * checkout asks for a name again before an order is placed.
 */
function DetailsPane({ redirect }: { redirect: string | null }) {
  const t = useTranslations("auth")
  const { slug, base } = useShop()
  const client = useApolloClient()
  const [leaving, setLeaving] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", email: "" },
  })

  const [updateProfile, { loading }] = useMutation(UPDATE_MY_PROFILE)

  async function leave() {
    setLeaving(true)
    await finishSignIn({ slug, base, client, redirect })
  }

  async function onSubmit(values: DetailsValues) {
    try {
      await updateProfile({
        variables: {
          input: {
            name: values.name,
            ...(values.email ? { email: values.email } : {}),
          },
        },
      })
    } catch (error) {
      // The server's own rules are a little stricter than this form's (no
      // `@`, links or phone numbers in a name): say which field, and stay.
      const fields = getValidationErrors(error).map((e) => e.field)
      if (fields.includes("name")) {
        setError("name", { type: "server", message: t("nameError") })
        return
      }
      if (fields.includes("email")) {
        setError("email", { type: "server", message: t("emailError") })
        return
      }
      // Anything else: the name is a courtesy, not the transaction.
      sileo.error({ title: t("detailsFailed") })
    }
    sileo.success({ title: t("welcome") })
    await leave()
  }

  return (
    <form
      method="post"
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="details-name" className="text-xs font-medium">
          {t("name")}
        </Label>
        <Input
          id="details-name"
          autoComplete="name"
          autoFocus
          aria-invalid={!!errors.name}
          className="h-11 rounded-xl border-shop-hairline"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{t("nameError")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="details-email" className="text-xs font-medium">
          {t("email")}
        </Label>
        <Input
          id="details-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          aria-invalid={!!errors.email}
          className="h-11 rounded-xl border-shop-hairline"
          {...register("email")}
        />
        <p
          className={cn(
            "text-xs",
            errors.email ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {errors.email ? t("emailError") : t("emailHint")}
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-11 w-full rounded-full bg-shop-accent text-base text-shop-accent-foreground hover:bg-shop-accent/90"
        disabled={loading || leaving}
      >
        {loading ? t("savingDetails") : t("saveDetails")}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={loading || leaving}
        onClick={() => void leave()}
      >
        {t("skipDetails")}
      </Button>
    </form>
  )
}

/** A refused code, as the field under the boxes says it. */
const CODE_FIELD_ERRORS: Record<string, string> = {
  OTP_INVALID: "otpInvalid",
  OTP_EXPIRED: "otpExpired",
  OTP_LOCKED: "otpLocked",
  OTP_ALREADY_USED: "otpAlreadyUsed",
}

/** Every other refusal, as a toast. */
function errorKey(code: string | null): string {
  switch (code) {
    case "ACCOUNT_DISABLED":
      return "customerUnavailable"
    case "TOO_MANY_REQUESTS":
      return "otpDailyLimit"
    // The shop has had its hour's share of codes texted — about the shop,
    // not this number, so it says to come back rather than "you asked too
    // often".
    case "CUSTOMER_SIGN_IN_RATE_LIMITED":
      return "shopSignInBusy"
    case "SMS_GATEWAY_ERROR":
      return "smsUnavailable"
    default:
      return "genericError"
  }
}
