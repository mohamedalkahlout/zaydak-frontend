import { z } from "zod"

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

/** Client checks help the buyer; the API sniffs bytes and repeats every rule. */
export function receiptSchema(now = new Date()) {
  const earliest = new Date(now)
  earliest.setMonth(earliest.getMonth() - 6)
  return z.object({
    bank_account_id: z.string().min(1, "accountRequired"),
    sender_name: z.string().trim().min(2, "senderRequired").max(150, "senderRequired"),
    sender_bank_code: z.string().trim().max(100).optional(),
    transfer_reference: z.string().trim().min(1, "referenceRequired").max(150, "referenceRequired"),
    transferred_at: z.string().refine((value) => {
      const time = new Date(value).getTime()
      return Number.isFinite(time) && time <= now.getTime()
    }, "dateFuture").refine((value) => new Date(value).getTime() >= earliest.getTime(), "dateOld"),
    claimed_amount: z.string().trim().refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 21474836.47, "amountInvalid"),
    note: z.string().trim().max(500, "noteTooLong"),
    file: z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, "fileRequired")
      .refine((value) => !value || RECEIPT_TYPES.includes(value.type), "fileType")
      .refine((value) => !value || value.size > 0 && value.size <= RECEIPT_MAX_BYTES, "fileSize"),
  })
}

export type ReceiptFields = z.infer<ReturnType<typeof receiptSchema>>
