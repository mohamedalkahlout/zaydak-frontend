import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import en from "@/shared/messages/en.json"
import ar from "@/shared/messages/ar.json"
import {
  canCancel,
  canPayByCard,
  displayStatus,
  isPaymentRefunded,
  moneyRefunded,
  PAYMENT_LABEL_KEY,
  paymentGatewayLabel,
  orderPaymentDueDate,
} from "../status"

describe("displayStatus", () => {
  it("handles the actual prefixed lifecycle and awaiting-transfer financial state", () => {
    expect(displayStatus({ order_status: "order-pending", financial_status: "authorized" })).toBe("pending")
    expect(displayStatus({ order_status: "order-completed", financial_status: "paid" })).toBe("completed")
    expect(canCancel({ order_status: "order-completed", fulfillment_status: "unfulfilled" })).toBe(false)
    expect(PAYMENT_LABEL_KEY["payment-failed"]).toBe("paymentFailed")
    expect(PAYMENT_LABEL_KEY["payment-awaiting-for-approval"]).toBe("paymentAwaitingApproval")
  })
  it("shows a fresh unpaid order as pending", () => {
    expect(
      displayStatus({ order_status: "pending", financial_status: "pending" }),
    ).toBe("pending")
  })

  it("shows a paid but unshipped order as processing", () => {
    expect(
      displayStatus({ order_status: "pending", financial_status: "paid" }),
    ).toBe("processing")
  })

  it("shows a completed order as completed", () => {
    expect(
      displayStatus({ order_status: "completed", financial_status: "paid" }),
    ).toBe("completed")
  })

  it("lets cancelled outrank everything", () => {
    expect(
      displayStatus({ order_status: "cancelled", financial_status: "paid" }),
    ).toBe("cancelled")
  })

  it("lets refunded outrank a completed lifecycle", () => {
    // A refunded order is not "completed" no matter what the lifecycle says.
    expect(
      displayStatus({ order_status: "completed", financial_status: "refunded" }),
    ).toBe("refunded")
  })

  it("is case-insensitive, since these arrive as free-form strings", () => {
    expect(
      displayStatus({ order_status: "CANCELLED", financial_status: "PAID" }),
    ).toBe("cancelled")
  })

  it("catches the order-cancelled variants the API uses", () => {
    for (const status of ["cancelled", "canceled", "order_cancelled"]) {
      expect(
        displayStatus({ order_status: status, financial_status: "pending" }),
      ).toBe("cancelled")
    }
  })
})

/**
 * A card payment that arrived after its order had closed and was sent back
 * leaves `payment-refunded` on a closed order (`financial_status: refunded`).
 * The storefront, the chat and the pay link have to agree about it: it reads
 * "Refunded", it is not payable, and it is not "awaiting payment".
 */
describe("a refunded payment", () => {
  it("labels the API's refunded and reversal statuses as Refunded", () => {
    expect(PAYMENT_LABEL_KEY["payment-refunded"]).toBe("paymentRefunded")
    // `PaymentStatus.REVERSAL` is `payment-reversal`. The row used to be keyed
    // `payment-reversed`, which nothing sends, so it fell back to "pending".
    expect(PAYMENT_LABEL_KEY["payment-reversal"]).toBe("paymentRefunded")
    expect(PAYMENT_LABEL_KEY["payment-reversed"]).toBeUndefined()
  })

  it("knows the refunded stray payment by its status, whatever the case", () => {
    expect(isPaymentRefunded("payment-refunded")).toBe(true)
    expect(isPaymentRefunded("PAYMENT-REFUNDED")).toBe(true)
    expect(isPaymentRefunded("payment-pending")).toBe(false)
    expect(isPaymentRefunded(null)).toBe(false)
    expect(isPaymentRefunded(undefined)).toBe(false)
  })

  it("reads the money as refunded from either field", () => {
    // The order list selects no `payment`: the derived financial status is
    // what it has.
    expect(moneyRefunded({ financial_status: "refunded" })).toBe(true)
    expect(
      moneyRefunded({
        financial_status: "voided",
        payment: { status: "payment-refunded" },
      }),
    ).toBe(true)
    expect(
      moneyRefunded({
        financial_status: "pending",
        payment: { status: "payment-pending" },
      }),
    ).toBe(false)
    expect(moneyRefunded({ financial_status: "paid", payment: null })).toBe(
      false,
    )
  })

  it("keeps Cancelled as the status of a cancelled order whose payment came back", () => {
    expect(
      displayStatus({
        order_status: "order-cancelled",
        financial_status: "refunded",
      }),
    ).toBe("cancelled")
    // A voided (failed) order has no cancelled chip to outrank it.
    expect(
      displayStatus({
        order_status: "order-failed",
        financial_status: "refunded",
      }),
    ).toBe("refunded")
  })

  it("never offers to pay by card again", () => {
    expect(
      canPayByCard({
        order_status: "order-pending",
        payment: { gateway: "STRIPE", status: "payment-refunded" },
      }),
    ).toBe(false)
    expect(
      canPayByCard({
        order_status: "order-cancelled",
        payment: { gateway: "STRIPE", status: "payment-refunded" },
      }),
    ).toBe(false)
  })
})

/**
 * Every payment status the API can send, read from where the API defines them.
 *
 * Read from the back-end's source rather than copied here, because a copy is
 * exactly what goes stale: the order page falls back to "Payment pending" for
 * a status it has no row for, and that fallback is silent. `payment-mismatch`
 * is not a member of the enum — the settle writes it as a bare string — so it
 * is read from the file that names it.
 */
function apiPaymentStatuses(): string[] {
  // Resolved from this file's own path. Not `new URL(…, import.meta.url)`:
  // Vite rewrites that shape as an asset reference and hands back `undefined`.
  const backEndSrc = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../../../../back-end/src",
  )
  const backEnd = (file: string) =>
    readFileSync(resolve(backEndSrc, file), "utf8")
  const block =
    /export enum PaymentStatus \{([\s\S]*?)\}/.exec(
      backEnd("orders/types/order-enums.ts"),
    )?.[1] ?? ""
  const members = [...block.matchAll(/=\s*'([^']+)'/g)].map((m) => m[1])
  const mismatch = /export const PAYMENT_MISMATCH = '([^']+)'/.exec(
    backEnd("payment-intents/order-payment-settle.ts"),
  )?.[1]
  return [...members, ...(mismatch ? [mismatch] : [])]
}

describe("PAYMENT_LABEL_KEY", () => {
  const statuses = apiPaymentStatuses()

  it("finds the API's statuses, so an empty walk cannot pass for a clean one", () => {
    expect(statuses.length).toBeGreaterThanOrEqual(11)
    expect(statuses).toContain("payment-pending")
    expect(statuses).toContain("payment-success")
    expect(statuses).toContain("payment-mismatch")
  })

  it.each(statuses)("has a label in both languages for %s", (status) => {
    const key = PAYMENT_LABEL_KEY[status]
    expect(key, `no row for ${status}`).toBeTruthy()
    expect((en.orders as Record<string, string>)[key]).toBeTruthy()
    expect((ar.orders as Record<string, string>)[key]).toBeTruthy()
  })

  it("does not call money that was received pending", () => {
    for (const paid of ["payment-success", "payment-cash", "payment-wallet"]) {
      expect(PAYMENT_LABEL_KEY[paid]).not.toBe("paymentPending")
    }
    // The customer paid; the shop is looking at it.
    expect(PAYMENT_LABEL_KEY["payment-mismatch"]).toBe("paymentChecking")
  })

  it("words a payment the shop is checking for the shopper, not the merchant", () => {
    // The merchant's screen says "Refund needed". That is an instruction to
    // the shop, and no way to tell the person who paid.
    expect(en.orders.paymentChecking).toMatch(/checked by the shop/i)
    expect(en.orders.paymentChecking).not.toMatch(/refund/i)
    expect(ar.orders.paymentChecking).not.toMatch(/استرداد|استرجاع/)
  })
})

describe("canCancel", () => {
  it("allows cancelling an unshipped order", () => {
    expect(
      canCancel({ order_status: "pending", fulfillment_status: "unfulfilled" }),
    ).toBe(true)
  })

  it("refuses once anything has shipped", () => {
    expect(
      canCancel({ order_status: "processing", fulfillment_status: "partial" }),
    ).toBe(false)
    expect(
      canCancel({ order_status: "processing", fulfillment_status: "fulfilled" }),
    ).toBe(false)
  })

  it("refuses a completed or already-cancelled order", () => {
    expect(
      canCancel({ order_status: "completed", fulfillment_status: "unfulfilled" }),
    ).toBe(false)
    expect(
      canCancel({ order_status: "cancelled", fulfillment_status: "unfulfilled" }),
    ).toBe(false)
  })
})

describe("paymentGatewayLabel", () => {
  const fakeTranslate = (key: string) => `translated:${key}`

  it("translates standard gateways properly without raw strings", () => {
    expect(paymentGatewayLabel("BANK_TRANSFER", fakeTranslate)).toBe("translated:paymentBank")
    expect(paymentGatewayLabel("CASH_ON_DELIVERY", fakeTranslate)).toBe("translated:paymentCod")
    expect(paymentGatewayLabel("STRIPE", fakeTranslate)).toBe("translated:paymentCard")
    expect(paymentGatewayLabel("CASH", fakeTranslate)).toBe("translated:paymentCash")
    expect(paymentGatewayLabel("INVOICE", fakeTranslate)).toBe("translated:paymentInvoice")
    expect(paymentGatewayLabel("FULL_WALLET_PAYMENT", fakeTranslate)).toBe("translated:paymentWallet")
  })

  it("handles case-insensitivity and fallback", () => {
    expect(paymentGatewayLabel("invoice", fakeTranslate)).toBe("translated:paymentInvoice")
    expect(paymentGatewayLabel("cash", fakeTranslate)).toBe("translated:paymentCash")
    expect(paymentGatewayLabel("UNKNOWN_GW", fakeTranslate)).toBe("UNKNOWN_GW")
    expect(paymentGatewayLabel(null, fakeTranslate)).toBe("—")
  })
})

describe("orderPaymentDueDate", () => {
  it("extracts the earliest invoice due date", () => {
    expect(
      orderPaymentDueDate({
        invoices: [
          { due_date: "2026-10-15T00:00:00.000Z" },
          { due_date: "2026-10-01T00:00:00.000Z" },
        ],
      }),
    ).toBe("2026-10-01T00:00:00.000Z")
  })

  it("returns null when no invoices or due dates are present", () => {
    expect(orderPaymentDueDate({ invoices: [] })).toBeNull()
    expect(orderPaymentDueDate({ invoices: [{ due_date: null }] })).toBeNull()
    expect(orderPaymentDueDate({})).toBeNull()
  })
})
