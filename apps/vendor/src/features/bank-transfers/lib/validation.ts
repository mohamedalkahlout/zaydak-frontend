import { z } from "zod"
import type { BankTransfer, PaymentSettingsPatch, ShopPaymentSettings } from "../types"

export function normalizeIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase()
}

export function isSaudiIban(value: string): boolean {
  const normalized = normalizeIban(value)
  if (!/^SA\d{22}$/.test(normalized)) return false
  const rearranged = normalized.slice(4) + normalized.slice(0, 4)
  let remainder = 0
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function displayIban(value: string | null | undefined): string {
  if (!value) return ""
  return normalizeIban(value).replace(/(.{4})(?=.)/g, "$1 ")
}

const bankAccountBase = {
  bank_code: z.string(),
  bank_name: z.string().trim().max(120, "nameTooLong"),
  account_holder_name: z.string().trim().min(2, "holderRequired").max(120, "nameTooLong"),
  iban: z.string(),
  account_number: z.string().trim().max(50, "accountNumberTooLong"),
  swift_code: z.string().trim().toUpperCase(),
  notes: z.string().trim().max(500, "notesTooLong"),
  is_active: z.boolean(),
  sort_order: z.number().int("invalidSort").min(0, "invalidSort").max(10000, "invalidSort"),
}

/** Saudi catalogue + IBAN — CountryProfile.bank_account_mode = SAUDI_IBAN. */
export const saudiBankAccountSchema = z.object({
  ...bankAccountBase,
  bank_code: z.string().min(1, "bankRequired"),
  iban: z.string().transform(normalizeIban).refine(isSaudiIban, "invalidIban"),
  swift_code: z.string().trim().toUpperCase().refine(
    (value) => !value || /^[A-Z]{4}SA[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value),
    "invalidSwift",
  ),
}).superRefine((value, context) => {
  if (value.bank_code === "other" && !value.bank_name) {
    context.addIssue({ code: "custom", path: ["bank_name"], message: "bankNameRequired" })
  }
})

/** Freeform — bank name + account number or IBAN (Palestine launch). */
export const freeformBankAccountSchema = z.object({
  ...bankAccountBase,
  bank_name: z.string().trim().min(1, "bankNameRequired").max(120, "nameTooLong"),
  iban: z.string().transform((value) => (value.trim() ? normalizeIban(value) : "")),
  swift_code: z.string().trim().toUpperCase(),
}).superRefine((value, context) => {
  if (!value.account_number.trim() && !value.iban) {
    context.addIssue({
      code: "custom",
      path: ["account_number"],
      message: "accountOrIbanRequired",
    })
  }
})

export function bankAccountSchemaFor(mode: "SAUDI_IBAN" | "FREEFORM") {
  return mode === "FREEFORM" ? freeformBankAccountSchema : saudiBankAccountSchema
}

/** @deprecated Prefer bankAccountSchemaFor(mode). Kept for SAUDI_IBAN call sites. */
export const bankAccountSchema = saudiBankAccountSchema

export type BankAccountDraft = z.input<typeof saudiBankAccountSchema>

export function paymentSettingsPatch(
  server: ShopPaymentSettings,
  draft: PaymentSettingsPatch,
): PaymentSettingsPatch {
  const patch: PaymentSettingsPatch = {}
  for (const key of ["cod_enabled", "card_enabled", "bank_transfer_enabled"] as const) {
    if (draft[key] !== undefined && draft[key] !== server[key]) patch[key] = draft[key]
  }
  return patch
}

export function canReviewTransfer(transfer: Pick<BankTransfer, "status" | "can_review">): boolean {
  return transfer.status === "PENDING" && transfer.can_review
}

export function validRejectionReason(reason: string): boolean {
  return reason.trim().length >= 3 && reason.trim().length <= 500
}
