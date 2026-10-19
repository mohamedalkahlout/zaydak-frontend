"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"

import { START_VENDOR_SIGNUP } from "../../api"
import type { SignupDraftData, StartVendorSignupResponse } from "../../types"
import { findCountryByCode } from "../../lib/countries"
import {
  signupPersonalSchema,
  toInternationalPhone,
  type SignupPersonalInput,
} from "../../validations/signup"
import { AuthHeading } from "@repo/ui/components/auth-heading"
import { AuthInput, AuthSubmit } from "@repo/ui/components/auth-form"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"

import { applyValidationErrors, getErrorCode } from "@/shared/lib/auth/graphql-errors"
import { PhoneField } from "../phone-field"

/**
 * Step 2. Submitting texts a code and hands back a signed draft — still no user
 * row, so abandoning here leaves nothing behind.
 */
export function PersonalStep({
  email,
  defaults,
  onSent,
  onEmailRejected,
}: {
  email: string
  defaults: { name: string; countryCode: string; phone: string }
  onSent: (draft: SignupDraftData, values: SignupPersonalInput) => void
  /** The email turned out to be taken after all — send the vendor back a step. */
  onEmailRejected: () => void
}) {
  const t = useTranslations("signup")
  const tv = useTranslations("signup.validation")

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupPersonalInput>({
    resolver: zodResolver(signupPersonalSchema(tv)),
    defaultValues: {
      name: defaults.name,
      country_code: findCountryByCode(defaults.countryCode).code,
      phone: defaults.phone,
    },
  })

  const [start, { loading }] = useMutation<StartVendorSignupResponse>(START_VENDOR_SIGNUP)

  const onSubmit = async (values: SignupPersonalInput) => {
    try {
      const { data } = await start({
        variables: {
          input: {
            email,
            name: values.name.trim(),
            phone: toInternationalPhone(
              findCountryByCode(values.country_code).dial,
              values.phone,
            ),
          },
        },
      })

      const draft = data?.startVendorSignup?.data
      if (draft) onSent(draft, values)
    } catch (err) {
      const code = getErrorCode(err)

      if (code === "PHONE_ALREADY_TAKEN") {
        setError("phone", { type: "server", message: t("personal.phoneTaken") })
        return
      }

      if (code === "EMAIL_ALREADY_TAKEN") {
        onEmailRejected()
        return
      }

      applyValidationErrors(err, setError, ["name", "phone"])
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
      <AuthHeading
        className="mb-6"
        title={t("personal.title")}
        description={t("personal.subtitle")}
      />

      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="signup-name">{t("personal.name")}</FieldLabel>
          <AuthInput
            id="signup-name"
            autoComplete="name"
            autoFocus
            placeholder={t("personal.namePlaceholder")}
            aria-invalid={!!errors.name || undefined}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="signup-phone">{t("personal.phone")}</FieldLabel>
          <Controller
            control={control}
            name="country_code"
            render={({ field }) => (
              <PhoneField
                id="signup-phone"
                countryCode={field.value}
                onCountryChange={field.onChange}
                placeholder={t("personal.phonePlaceholder")}
                invalid={!!errors.phone}
                inputProps={register("phone")}
              />
            )}
          />
          <FieldError errors={[errors.phone]} />
        </Field>

        <AuthSubmit disabled={loading}>
          {loading ? t("sending") : t("continue")}
        </AuthSubmit>
      </div>
    </form>
  )
}
