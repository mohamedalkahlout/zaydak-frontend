import { z } from "zod"

import { isEmail } from "@/shared/lib/contact-validation"

/**
 * The message cap, and it is **the server's number**.
 *
 * `SendContactMessageInput.message` carries `@MaxLength(2000)` and
 * `back-end/src/conversations/dto/send-contact-message.input.ts` exports the
 * constant for the same reason this file re-states it: two places spelling
 * 2000 is how a counter that says "150 characters left" starts submitting into
 * a `Validation failed`. There is no shared package between the API and this
 * app, so the mirror is the only option — the spec on both sides pins the
 * literal so a change on either is a failing test rather than a silent drift.
 */
export const CONTACT_MESSAGE_MAX_LENGTH = 2000

/** `@MaxLength(120)` on `name`. */
export const CONTACT_NAME_MAX_LENGTH = 120

/** `@MaxLength(254)` on `email` — the RFC 5321 ceiling the DTO also uses. */
export const CONTACT_EMAIL_MAX_LENGTH = 254

/** `@MaxLength(64)` on `order_number`. */
export const CONTACT_ORDER_NUMBER_MAX_LENGTH = 64

/**
 * What the form will submit.
 *
 * The email rule is `isEmail` from `shared/lib/contact-validation.ts` rather
 * than a regex written here: the storefront already had one RFC-5322 pattern
 * and a second copy is a second answer to "is this an address", which is the
 * kind of disagreement that shows up as a field the checkout accepts and this
 * form rejects.
 *
 * **`website` is validated as loosely as it possibly can be, on purpose.** It
 * is the honeypot, and a refusal here — a length cap, a URL shape — would be a
 * *distinguishable answer*: a bot that can tell a rejected submission from an
 * accepted one simply stops filling the field in. The client's job is to carry
 * whatever landed in it to the server untouched and let the trap be sprung
 * there, where the answer is indistinguishable from a success.
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH),
  email: z
    .string()
    .trim()
    .min(1)
    .max(CONTACT_EMAIL_MAX_LENGTH)
    .refine((value) => isEmail(value)),
  order_number: z
    .string()
    .trim()
    .max(CONTACT_ORDER_NUMBER_MAX_LENGTH)
    .optional(),
  message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX_LENGTH),
  website: z.string().optional(),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
