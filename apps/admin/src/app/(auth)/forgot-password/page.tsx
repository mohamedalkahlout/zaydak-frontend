"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { AuthInput, AuthSubmit } from "@repo/ui/components/auth-form"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field"

import { resetPasswordHref, useForgetPassword } from "@/features/auth/lib/send-code"
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/validations"
import { applyValidationErrors } from "@/shared/auth/graphql-errors"

export default function ForgotPasswordPage() {
  const t = useTranslations("auth")
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  const [forgetPassword, { loading }] = useForgetPassword()

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      const sent = await forgetPassword(data.identifier)
      if (!sent.success) return

      sileo.success({
        title: t("forgotPassword.resetCodeSent"),
        description: t("forgotPassword.useCodeDesc"),
      })
      router.push(resetPasswordHref(data.identifier, sent.codeLength))
    } catch (err) {
      applyValidationErrors(err, setError, ["identifier"])
    }
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
