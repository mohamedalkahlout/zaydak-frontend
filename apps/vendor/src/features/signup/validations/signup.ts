import { z } from "zod"

import type { Translate } from "@/shared/i18n/translator"

/**
 * Every schema takes the `signup.validation` translator: a zod message is fixed
 * when the schema is built, so one declared with English literals would stay
 * English under an Arabic dashboard.
 */
export const signupEmailSchema = (t: Translate) =>
  z.object({
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
  })

export const signupPersonalSchema = (t: Translate) =>
  z.object({
    name: z.string().trim().min(2, t("nameRequired")).max(120),
    /**
     * ISO alpha-2, not the dial code: `+1` belongs to several countries, so the
     * dial code alone cannot say which flag the picker should show.
     */
    country_code: z.string().length(2),
    /**
     * National number only — the picker supplies the country part. Leading zeros
     * are how the number is printed locally (`055...`) but not how it is dialled
     * internationally, so they are stripped before the two halves are joined.
     */
    phone: z
      .string()
      .trim()
      .min(6, t("phoneInvalid"))
      .max(15)
      .regex(/^[\d\s-]+$/, t("phoneDigitsOnly")),
  })

/**
 * Built per draft rather than declared once: the code's length is a platform
 * setting an admin can change, and the server tells us what it issued. A schema
 * hardcoded to six would reject every code the moment they shorten them.
 */
export function signupOtpSchemaFor(length: number, t: Translate) {
  return z.object({
    code: z
      .string()
      .length(length, t("codeLength", { length }))
      .regex(/^\d+$/, t("codeDigitsOnly")),
  })
}

export type SignupEmailInput = z.infer<ReturnType<typeof signupEmailSchema>>
export type SignupPersonalInput = z.infer<ReturnType<typeof signupPersonalSchema>>
export type SignupOtpInput = z.infer<ReturnType<typeof signupOtpSchemaFor>>

/**
 * Joins the picker's dial code with the typed national number into the E.164
 * string the API expects. Kept here rather than in the form so the OTP screen
 * and the submit path cannot disagree about what was dialled.
 */
export function toInternationalPhone(dialCode: string, national: string): string {
  return `+${dialCode}${national.replace(/\D/g, "").replace(/^0+/, "")}`
}
