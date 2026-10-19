import type {
  DraftConvertGateway,
  DraftPaymentTerm,
} from "@/features/orders/types"

/** The draft form's terms select, in display order. */
export const DRAFT_PAYMENT_TERMS: readonly DraftPaymentTerm[] = [
  "due_on_receipt",
  "net_7",
  "net_15",
  "net_30",
]

/**
 * The stored term as the select holds it. A draft with none (or one this
 * build does not know) shows "Due on receipt", which is also how the server
 * dates an invoice that carries no term.
 */
export function readDraftPaymentTerm(
  value: string | null | undefined,
): DraftPaymentTerm {
  return (DRAFT_PAYMENT_TERMS as readonly string[]).includes(value ?? "")
    ? (value as DraftPaymentTerm)
    : "due_on_receipt"
}

/**
 * The gateway the convert button sends, named explicitly so the order never
 * depends on a server default. "Mark as paid" is CASH: recorded as paid, with
 * nothing for a courier to collect and no dependence on the shop's
 * cash-on-delivery switch. "Payment due later" is INVOICE: payment pending,
 * due on the draft's terms, settled later from the order page.
 */
export function draftConvertGateway(
  paymentDueLater: boolean,
): DraftConvertGateway {
  return paymentDueLater ? "INVOICE" : "CASH"
}
