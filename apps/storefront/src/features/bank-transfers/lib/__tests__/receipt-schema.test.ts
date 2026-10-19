import { describe, expect, it } from "vitest"
import { RECEIPT_MAX_BYTES, receiptSchema } from "../receipt-schema"

const now = new Date("2026-09-09T12:00:00Z")
const valid = () => ({
  bank_account_id: "account-1",
  sender_name: "Sara Ahmad",
  transfer_reference: "REF-2026",
  transferred_at: "2026-09-09T10:00:00Z",
  claimed_amount: "123.45",
  note: "",
  file: new File(["receipt"], "receipt.pdf", { type: "application/pdf" }),
})

describe("receipt form validation", () => {
  it("allows an optional sender bank and claimed amount", () => {
    expect(receiptSchema(now).safeParse({ ...valid(), claimed_amount: "" }).success).toBe(true)
  })
  it.each(["2026-09-10T00:00:00Z", "2026-03-01T00:00:00Z", "not a date"])("refuses the invalid transfer date %s", (transferred_at) => {
    expect(receiptSchema(now).safeParse({ ...valid(), transferred_at }).success).toBe(false)
  })
  it.each(["0", "-20", "1.005", "Infinity", "21474836.48"])("refuses an invalid claimed amount %s", (claimed_amount) => {
    expect(receiptSchema(now).safeParse({ ...valid(), claimed_amount }).success).toBe(false)
  })
  it("refuses missing receipts, active SVG files, empty files and oversized files", () => {
    for (const file of [
      null,
      new File(["<svg/>"], "receipt.svg", { type: "image/svg+xml" }),
      new File([], "receipt.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(RECEIPT_MAX_BYTES + 1)], "receipt.pdf", { type: "application/pdf" }),
    ]) expect(receiptSchema(now).safeParse({ ...valid(), file }).success).toBe(false)
  })
})
