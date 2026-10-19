import { z } from "zod"
import { UserRole } from "@/shared/api/generated/graphql"

/**
 * Mirrors `CreateUserInput` / `AdminUpdateUserInput`.
 *
 * The rules are copied from the back-end's class-validator decorators rather
 * than loosened: an account created here logs in through the ordinary login
 * screen, so a password the server would reject is not worth a round trip.
 */

/** Same character classes `CreateUserInput` requires, same 72-byte bcrypt ceiling. */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
    "Password needs an uppercase letter, a lowercase letter, a number and one of !@#$%^&*",
  )

/** `RegisterInput`'s pattern — permissive about spacing, strict about length. */
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s\-()]{7,20}$/, "Enter a valid phone number")
  .or(z.literal(""))

const identity = {
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  phone,
  role: z.enum(UserRole),
  email_verified: z.boolean(),
  permissions: z.array(z.string()).optional(),
}

/**
 * An account needs at least one identifier, because both are how you sign in.
 * The server refuses the same combination — this is only so the admin finds out
 * before submitting.
 */
const hasIdentifier = (v: { email: string; phone: string }) =>
  v.email.length > 0 || v.phone.length > 0

/** Rebuilt per call: zod's `path` is a mutable array in its own signature. */
const identifierIssue = () => ({
  message: "An email or a phone number is required",
  path: ["email"],
})

export const createUserSchema = z
  .object({ ...identity, password })
  .refine(hasIdentifier, identifierIssue())

export const editUserSchema = z
  .object(identity)
  .refine(hasIdentifier, identifierIssue())

export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type EditUserFormValues = z.infer<typeof editUserSchema>
