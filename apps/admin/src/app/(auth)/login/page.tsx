"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { AuthInput, AuthSubmit } from "@repo/ui/components/auth-form"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/components/field"

import { LOGIN } from "@/features/auth/api"
import { loginSchema, type LoginInput } from "@/features/auth/validations"
import { isAdminRole } from "@/shared/auth/roles"
import { applyValidationErrors, getErrorCode } from "@/shared/auth/graphql-errors"
import { safeRedirect } from "@/shared/lib/redirect"
import { useAuthStore } from "@/shared/stores/auth"

export default function LoginPage() {
  const t = useTranslations("auth")
  const router = useRouter()
  const searchParams = useSearchParams()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [failedAttempts, setFailedAttempts] = useState(0)

  const expired = searchParams.has("expired")
  useEffect(() => {
    if (expired) sileo.error({ title: t("sessionExpired") })
  }, [expired, t])

  // The route guard bounced a signed-in non-admin (e.g. a vendor whose session
  // was still in the shared cookie jar) and cleared their stale cookies.
  const forbidden = searchParams.has("forbidden")
  useEffect(() => {
    if (forbidden) sileo.error({ title: t("notAdmin") })
  }, [forbidden, t])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const [login, { loading }] = useMutation(LOGIN)

  const onSubmit = async (data: LoginInput) => {
    try {
      const { data: result } = await login({ variables: { input: data } })
      if (!result?.login?.success || !result.login.data) return

      // Gate BEFORE persisting the session — writing the cookie first would
      // briefly hand a non-admin a token the route guard accepts. The back-end
      // still authorizes every operation; this only keeps vendors and customers
      // out of a console they cannot use.
      if (!isAdminRole(result.login.data.role)) {
        setError("identifier", { type: "server", message: t("notAdmin") })
        return
      }

      await setTokens(result.login.data)
      setFailedAttempts(0)
      sileo.success({ title: t("login.welcomeBack") })

      const redirectParam = searchParams.get("redirect")
      const redirect = safeRedirect(redirectParam, "/users")
      router.push(redirect === "/login" ? "/users" : redirect)
    } catch (err) {
      const code = getErrorCode(err)
      applyValidationErrors(err, setError, ["identifier", "password"])

      if (code === "ACCOUNT_LOCKED") {
        sileo.error({
          title: t("login.accountLocked"),
          description: t("login.accountLockedDesc"),
        })
        return
      }

      if (code && code !== "VALIDATION_ERROR") {
        const nextFailures = failedAttempts + 1
        setFailedAttempts(nextFailures)
        if (nextFailures >= 3) {
          sileo.error({
            title: t("login.warning"),
            description: t("login.warningDesc"),
          })
        }
        return
      }

      if (err instanceof Error && err.message === "Failed to persist session") {
        sileo.error({
          title: t("sessionFailed"),
        })
      }
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <AuthHeading
          eyebrow={t("login.eyebrow")}
          title={t("login.title")}
          description={t("login.subtitle")}
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
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
            <Link
              href="/forgot-password"
              className="ms-auto text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPassword.title")}
            </Link>
          </div>
          <AuthInput
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Field>
          <AuthSubmit disabled={loading}>
            {loading ? t("login.signingIn") : t("signIn")}
          </AuthSubmit>
        </Field>
        <FieldSeparator>{t("or")}</FieldSeparator>
        <Field>
          {/* One focus stop, one role: a button-styled link — never a native
              <button> nested inside an <a>. */}
          <AuthSubmit
            variant="outline"
            nativeButton={false}
            render={<Link href="/verify-otp" />}
          >
            {t("login.signInWithOtp")}
          </AuthSubmit>
        </Field>
      </FieldGroup>
    </form>
  )
}
