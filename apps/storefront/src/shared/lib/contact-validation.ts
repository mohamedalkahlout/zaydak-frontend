import { z } from "zod"

/**
 * Strict E.164 pattern:
 * - Begins with `+`
 * - Followed by 1-9 (country code cannot start with 0)
 * - Followed by 6 to 14 digits (total length between 7 and 15 digits)
 */
export const E164_REGEX = /^\+[1-9]\d{6,14}$/

/**
 * RFC 5322 compatible email pattern checking for valid local and domain parts.
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/**
 * Convert Arabic-Indic numerals (٠-٩) to ASCII Western digits (0-9).
 */
export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (char) => (char.charCodeAt(0) - 1632).toString())
}

/**
 * Check if the input is a valid RFC-compliant email.
 */
export function isEmail(value: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length > 254) return false
  return EMAIL_REGEX.test(trimmed)
}

/**
 * Check if the input is already a valid E.164 phone number.
 */
export function isE164(value: string): boolean {
  if (!value) return false
  return E164_REGEX.test(value.trim())
}

/**
 * Clean phone string from spaces, hyphens, brackets, dots and convert Arabic digits.
 */
export function sanitizePhone(raw: string): string {
  const western = toWesternDigits(raw.trim())
  const hasPlus = western.startsWith("+")
  const digitsOnly = western.replace(/\D/g, "")
  return hasPlus ? `+${digitsOnly}` : digitsOnly
}

/**
 * Normalize and convert a phone number into strict E.164 format.
 *
 * Supports:
 * - Numbers already starting with `+` (e.g. `+966501234567`)
 * - International prefix `00` (e.g. `00966501234567` -> `+966501234567`)
 * - Saudi local mobile numbers with leading 0 (e.g. `0501234567` -> `+966501234567`)
 * - Saudi local mobile numbers without leading 0 (e.g. `501234567` -> `+966501234567`)
 * - Other international numbers missing `+` if matching standard prefixes
 *
 * Returns the normalized E.164 string with `+` prefix, or `null` if invalid.
 */
export function normalizePhoneNumber(
  raw: string | null | undefined,
  defaultCountryCode = "+966",
): string | null {
  if (!raw) return null
  const cleaned = sanitizePhone(raw)
  if (!cleaned) return null

  // 1. Handle international prefix starting with 00 (e.g. 009665...)
  if (cleaned.startsWith("00")) {
    const candidate = `+${cleaned.slice(2)}`
    return isE164(candidate) ? candidate : null
  }

  // 2. Handle number already with `+`
  if (cleaned.startsWith("+")) {
    return isE164(cleaned) ? cleaned : null
  }

  // 3. Handle Saudi local mobile: 10 digits starting with 05... (e.g. 0501234567)
  if (cleaned.length === 10 && cleaned.startsWith("05")) {
    const candidate = `+966${cleaned.slice(1)}`
    return isE164(candidate) ? candidate : null
  }

  // 4. Handle Saudi local mobile: 9 digits starting with 5... (e.g. 501234567)
  if (cleaned.length === 9 && cleaned.startsWith("5")) {
    const candidate = `+966${cleaned}`
    return isE164(candidate) ? candidate : null
  }

  // 5. Handle Saudi number typed without plus: 9665... (12 digits)
  if (cleaned.startsWith("966") && cleaned.length === 12) {
    const candidate = `+${cleaned}`
    return isE164(candidate) ? candidate : null
  }

  // 6. Generic default country code fallback if provided
  if (defaultCountryCode) {
    const prefix = defaultCountryCode.startsWith("+")
      ? defaultCountryCode
      : `+${defaultCountryCode}`
    // If starts with single 0 trunk prefix, strip it
    const digits = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned
    const candidate = `${prefix}${digits}`
    if (isE164(candidate)) {
      return candidate
    }
  }

  return null
}

export type ContactType = "email" | "phone"

export interface ContactValidationResult {
  valid: boolean
  type: ContactType | null
  normalized: string
  error?: "required" | "invalid"
}

/**
 * Validate and categorize customer contact input as either an email or E.164 phone.
 */
export function validateContact(
  raw: string | null | undefined,
  defaultCountryCode = "+966",
): ContactValidationResult {
  if (!raw) {
    return { valid: false, type: null, normalized: "", error: "required" }
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return { valid: false, type: null, normalized: "", error: "required" }
  }

  // If it has '@', evaluate as email
  if (trimmed.includes("@")) {
    if (isEmail(trimmed)) {
      return {
        valid: true,
        type: "email",
        normalized: trimmed.toLowerCase(),
      }
    }
    return {
      valid: false,
      type: "email",
      normalized: trimmed,
      error: "invalid",
    }
  }

  // Otherwise, evaluate as phone number
  const normalizedPhone = normalizePhoneNumber(trimmed, defaultCountryCode)
  if (normalizedPhone) {
    return {
      valid: true,
      type: "phone",
      normalized: normalizedPhone,
    }
  }

  return {
    valid: false,
    type: null,
    normalized: trimmed,
    error: "invalid",
  }
}

/**
 * Zod schema for strict E.164 phone.
 */
export const e164PhoneSchema = z
  .string()
  .trim()
  .refine(
    (val) => !val || normalizePhoneNumber(val) !== null,
    { message: "Invalid phone number" },
  )
  .transform((val) => (val ? normalizePhoneNumber(val) ?? val : ""))

/**
 * Zod schema for contact (email OR E.164 phone).
 */
export const contactSchema = z
  .string()
  .trim()
  .min(1, "Contact is required")
  .refine(
    (val) => validateContact(val).valid,
    { message: "Please enter a valid email or phone number" },
  )
  .transform((val) => validateContact(val).normalized)
