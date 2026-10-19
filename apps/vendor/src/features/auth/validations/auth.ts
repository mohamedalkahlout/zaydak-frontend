import { z } from "zod"

import type { Translate } from "@/shared/i18n/translator"

/**
 * Every schema here is a factory over the `auth.validation` translator: a zod
 * message is fixed when the schema is built, so a schema declared once with
 * English literals would stay English under an Arabic dashboard.
 */
const passwordSchema = (t: Translate) =>
  z
    .string()
    .min(8, t("passwordMin"))
    .regex(/[A-Z]/, t("passwordUppercase"))
    .regex(/[a-z]/, t("passwordLowercase"))
    .regex(/[0-9]/, t("passwordDigit"))
    .regex(/[!@#$%^&*]/, t("passwordSpecial"))

export const loginSchema = (t: Translate) =>
  z.object({
    identifier: z.string().min(1, t("identifierRequired")),
    password: z.string().min(1, t("passwordRequired")),
  })

export const forgotPasswordSchema = (t: Translate) =>
  z.object({
    identifier: z.string().min(1, t("identifierRequired")),
  })

/**
 * One-time code lengths. The OTP settings take 4 to 8 and a Verify service is
 * held to the same range; the send tells the screen which one it issued.
 * `fallback` is what a screen draws when the server said nothing — an API
 * older than `code_length`, or a value outside the range.
 */
export const OTP_CODE_LENGTH = { min: 4, max: 8, fallback: 6 } as const

/** The server's `code_length`, or 6 for anything that is not a length in range. */
export function codeLengthFrom(raw: unknown): number {
  return typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= OTP_CODE_LENGTH.min &&
    raw <= OTP_CODE_LENGTH.max
    ? raw
    : OTP_CODE_LENGTH.fallback
}

/**
 * The mutation payload, which carries no length of its own — so any length a
 * code may have. The screen that collects the code checks the exact one.
 */
export const resetPasswordSchema = (t: Translate) =>
  z
    .object({
      identifier: z.string().min(1, t("identifierRequired")),
      code: z.string().regex(/^\d{4,8}$/, t("codeRange")),
      password: passwordSchema(t),
      password_confirmation: z.string(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t("passwordsMismatch"),
      path: ["password_confirmation"],
    })

/** The password screen after the reset OTP has already been collected. */
export const newPasswordSchema = (t: Translate) =>
  z
    .object({
      password: passwordSchema(t),
      password_confirmation: z.string(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t("passwordsMismatch"),
      path: ["password_confirmation"],
    })

/**
 * Built per code rather than declared once, like `signupOtpSchemaFor`: the
 * length is whatever the send said it issued.
 */
export function verifyOtpSchemaFor(length: number, t: Translate) {
  return z.object({
    code: z
      .string()
      .length(length, t("codeLength", { length }))
      .regex(/^\d+$/, t("codeDigitsOnly")),
  })
}

export const sendOtpSchema = (t: Translate) =>
  z.object({
    identifier: z.string().min(1, t("identifierRequired")),
  })

export const changePasswordSchema = (t: Translate) =>
  z
    .object({
      old_password: z.string().min(1, t("currentPasswordRequired")),
      password: passwordSchema(t),
      password_confirmation: z.string(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t("passwordsMismatch"),
      path: ["password_confirmation"],
    })

export type LoginInput = z.infer<ReturnType<typeof loginSchema>>
export type ForgotPasswordInput = z.infer<ReturnType<typeof forgotPasswordSchema>>
export type ResetPasswordInput = z.infer<ReturnType<typeof resetPasswordSchema>>
export type NewPasswordInput = z.infer<ReturnType<typeof newPasswordSchema>>
export type VerifyOtpInput = z.infer<ReturnType<typeof verifyOtpSchemaFor>>
export type SendOtpInput = z.infer<ReturnType<typeof sendOtpSchema>>
export type ChangePasswordInput = z.infer<ReturnType<typeof changePasswordSchema>>
