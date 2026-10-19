import { z } from "zod"

/** Mirrors the back-end's password policy (auth module). */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a digit")
  .regex(/[!@#$%^&*]/, "Must contain a special character (!@#$%^&*)")

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
})
export type LoginInput = z.infer<typeof loginSchema>

export const sendOtpSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
})
export type SendOtpInput = z.infer<typeof sendOtpSchema>

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

/** Built per code: the length is whatever the send said it issued. */
export function verifyOtpSchemaFor(length: number) {
  return z.object({
    code: z
      .string()
      .length(length, `Code must be ${length} digits`)
      .regex(/^\d+$/, "Code must be digits only"),
  })
}
export type VerifyOtpInput = z.infer<ReturnType<typeof verifyOtpSchemaFor>>

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/**
 * The mutation payload, which carries no length of its own — so any length a
 * code may have. The screen that collects the code checks the exact one.
 */
export const resetPasswordSchema = z
  .object({
    identifier: z.string().min(1, "Email or phone is required"),
    code: z.string().regex(/^\d{4,8}$/, "Code must be 4 to 8 digits"),
    password: passwordSchema,
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ["password_confirmation"],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/** The password screen after the reset OTP has already been collected. */
export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ["password_confirmation"],
  })
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
