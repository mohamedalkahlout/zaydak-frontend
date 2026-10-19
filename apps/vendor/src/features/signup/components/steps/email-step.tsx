"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLazyQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"

import { AuthHeading } from "@repo/ui/components/auth-heading"
import { AuthInput, AuthSubmit } from "@repo/ui/components/auth-form"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/components/field"

import { SocialAuthButtons } from "@/features/auth/components/social-auth-buttons"

import { VENDOR_SIGNUP_EMAIL_AVAILABLE } from "../../api"
import type { VendorSignupEmailAvailableResponse } from "../../types"
import { signupEmailSchema, type SignupEmailInput } from "../../validations/signup"

/**
 * Step 1. The address is checked before the wizard advances rather than at the
 * end: finding out your email is taken after picking a store name is the kind
 * of thing that loses a signup.
 */
export function EmailStep({
  defaultEmail,
  onNext,
}: {
  defaultEmail: string
  onNext: (email: string) => void
}) {
  const t = useTranslations("signup")
  const tv = useTranslations("signup.validation")

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupEmailInput>({
    resolver: zodResolver(signupEmailSchema(tv)),
    defaultValues: { email: defaultEmail },
  })

  const [checkEmail, { loading }] = useLazyQuery<VendorSignupEmailAvailableResponse>(
    VENDOR_SIGNUP_EMAIL_AVAILABLE,
    // The answer changes the moment someone else signs up, and the vendor may
    // come back to this pane after failing later — never serve it from cache.
    { fetchPolicy: "network-only" },
  )

  const onSubmit = async ({ email }: SignupEmailInput) => {
    const normalized = email.trim().toLowerCase()

    try {
      const { data } = await checkEmail({ variables: { email: normalized } })

      if (data?.vendorSignupEmailAvailable?.data?.available === false) {
        setError("email", { type: "server", message: t("email.taken") })
        return
      }
    } catch {
      // A failed availability probe is not a reason to block the wizard: the
      // final mutation re-checks and is the real gate.
    }

    onNext(normalized)
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthHeading
        className="mb-6"
        title={t("email.title")}
        description={t("email.subtitle")}
      />

      {/* `FieldGroup`, not a `space-y-*` stack: `FieldSeparator` carries a
          `-my-2` meant to trim a flex gap, and against `space-y`'s margins it
          wins on specificity — the rule ends up with no spacing at all and the
          "Or" pill lands on the buttons above and below it. Login stacks the
          same controls this way, which is also the point. */}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="signup-email">{t("email.label")}</FieldLabel>
          <AuthInput
            id="signup-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            autoFocus
            placeholder={t("email.placeholder")}
            aria-invalid={!!errors.email || undefined}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <AuthSubmit disabled={loading}>
            {loading ? t("checking") : t("email.submit")}
          </AuthSubmit>
        </Field>

        <FieldSeparator>{t("or")}</FieldSeparator>

        <SocialAuthButtons />

        {/* Fills the reference's social-signup slot with the passwordless
            sign-in this app actually has, rather than a provider it does not. */}
        <Field>
          <AuthSubmit
            variant="outline"
            nativeButton={false}
            render={<Link href="/verify-otp" />}
          >
            {t("email.signInWithCode")}
          </AuthSubmit>
        </Field>

        <p className="text-center text-sm text-muted-foreground">
          {t("email.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {t("email.login")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
