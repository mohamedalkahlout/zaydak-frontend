import { describe, it, expect } from "vitest"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import { cancelRefusalKey, isPaidCardOrder } from "../detail/cancel"

const refused = (code: string) =>
  new CombinedGraphQLErrors({
    errors: [
      {
        message: "Validation failed",
        extensions: {
          error_code: "VALIDATION_ERROR",
          validation_errors: [{ field: "order_status", code, messages: [] }],
        },
      },
    ],
  })

describe("isPaidCardOrder", () => {
  it("is a STRIPE order marked paid, whatever the case of the gateway", () => {
    expect(
      isPaidCardOrder({
        payment: { status: "payment-success", gateway: "STRIPE" },
      }),
    ).toBe(true)
    expect(
      isPaidCardOrder({
        payment: { status: "payment-success", gateway: "stripe" },
      }),
    ).toBe(true)
  })

  it.each([
    ["an unpaid card order", { status: "payment-pending", gateway: "STRIPE" }],
    ["a flagged card order", { status: "payment-mismatch", gateway: "STRIPE" }],
    ["a cash order", { status: "payment-success", gateway: "CASH" }],
    ["an order with no gateway", { status: "payment-success" }],
  ])("is not %s", (_label, payment) => {
    expect(isPaidCardOrder({ payment })).toBe(false)
  })
})

describe("cancelRefusalKey", () => {
  it("names the server's refund-first refusal", () => {
    expect(cancelRefusalKey(refused("REFUND_CARD_PAYMENT_FIRST"))).toBe(
      "cardPaid",
    )
  })

  it("reads anything else as the generic failure", () => {
    expect(cancelRefusalKey(refused("not_cancellable"))).toBe("failed")
    expect(cancelRefusalKey(new Error("Order not found"))).toBe("failed")
  })
})
