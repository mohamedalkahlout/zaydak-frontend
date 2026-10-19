"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { AuthInput, AuthSubmit } from "@repo/ui/components/auth-form"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { resetPasswordHref, useForgetPassword } from "@/features/auth/lib/send-code"
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/validations/auth"
import { applyValidationErrors } from "@/shared/lib/auth/graphql-errors"
import { sileo } from "sileo"

export default function ForgotPasswordPage() {
  const t = useTranslations("auth")
  const tv = useTranslations("auth.validation")
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema(tv)),
  })

  const [forgetPassword, { loading }] = useForgetPassword()

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      const sent = await forgetPassword(data.identifier)

      if (sent.success) {
        setSentTo(data.identifier)
        sileo.success({
          title: t("forgotPassword.resetCodeSent"),
          description: t("forgotPassword.useCodeDesc"),
        })
        router.push(resetPasswordHref(data.identifier, sent.codeLength))
      }
    } catch (err) {
      applyValidationErrors(err, setError, ["identifier"])
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <AuthHeading
          eyebrow={t("forgotPassword.eyebrow")}
          title={t("forgotPassword.checkInboxTitle")}
        />
        <p className="text-sm text-muted-foreground">
          {t.rich("forgotPassword.checkInboxDesc", {
            sentTo,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.didntGetIt")}{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("forgotPassword.tryAgain")}
          </button>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FieldGroup>
        <AuthHeading
          eyebrow={t("forgotPassword.eyebrow")}
          title={t("forgotPassword.title")}
          description={t("forgotPassword.subtitle")}
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
            {loading ? t("sending") : t("forgotPassword.sendCode")}
          </AuthSubmit>
        </Field>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.rememberPassword")}{" "}
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("signIn")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
