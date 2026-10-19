import { describe, expect, it } from "vitest"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { Order, OrderUnappliedPayment } from "../../types"
import {
  canCheckAgain,
  canRefundUnappliedPayment,
  needsCancelFirst,
  refundErrorKey,
  refusalKey,
  unappliedReasonKey,
} from "../detail/unapplied-payments"

const order = (
  order_status: Order["order_status"],
  status: Order["payment"]["status"] = "payment-mismatch",
) => ({ order_status, payment: { status, gateway: "STRIPE" } })

const payment = (
  reason: string,
  refund_status: OrderUnappliedPayment["refund_status"] = "none",
) => ({ reason, refund_status })

describe("unapplied payments", () => {
  it("refunds anything on a closed order", () => {
    for (const status of [
      "order-cancelled",
      "order-failed",
      "order-refunded",
    ] as const) {
      expect(
        canRefundUnappliedPayment(order(status), payment("amount_mismatch")),
      ).toBe(true)
      expect(
        canRefundUnappliedPayment(order(status), payment("paid_after_close")),
      ).toBe(true)
    }
  })

  it("refunds a second charge on an order that is still being fulfilled", () => {
    expect(
      canRefundUnappliedPayment(
        order("order-processing", "payment-success"),
        payment("duplicate_charge"),
      ),
    ).toBe(true)
  })

  it("refunds a different amount once another payment paid the order", () => {
    expect(
      canRefundUnappliedPayment(
        order("order-processing", "payment-success"),
        payment("amount_mismatch"),
      ),
    ).toBe(true)
  })

  it("asks to cancel first for a different amount on an order still open", () => {
    const open = order("order-pending")
    expect(canRefundUnappliedPayment(open, payment("amount_mismatch"))).toBe(
      false,
    )
    expect(needsCancelFirst(open, payment("amount_mismatch"))).toBe(true)
    expect(needsCancelFirst(open, payment("duplicate_charge"))).toBe(false)
  })

  it("offers a refund again after a failure, and nothing while one is under way or done", () => {
    const closed = order("order-cancelled")
    expect(
      canRefundUnappliedPayment(closed, payment("paid_after_close", "failed")),
    ).toBe(true)
    for (const status of ["requested", "pending", "succeeded"] as const) {
      expect(
        canRefundUnappliedPayment(closed, payment("paid_after_close", status)),
      ).toBe(false)
      expect(needsCancelFirst(closed, payment("paid_after_close", status))).toBe(
        false,
      )
    }
  })

  it("checks again only a refund the provider has not settled", () => {
    expect(canCheckAgain({ refund_status: "requested" })).toBe(true)
    expect(canCheckAgain({ refund_status: "pending" })).toBe(true)
    expect(canCheckAgain({ refund_status: "succeeded" })).toBe(false)
    expect(canCheckAgain({ refund_status: "failed" })).toBe(false)
    expect(canCheckAgain({ refund_status: "none" })).toBe(false)
  })

  it("names the provider’s codes a merchant can act on, and the rest generically", () => {
    expect(refundErrorKey("charge_disputed")).toBe("error.charge_disputed")
    expect(refundErrorKey("amount_too_large")).toBe("error.amount_too_large")
    expect(refundErrorKey("unconfirmed")).toBe("error.unconfirmed")
    expect(refundErrorKey("charge_already_refunded")).toBe(
      "error.charge_already_refunded",
    )
    expect(refundErrorKey("expired_or_canceled_card")).toBe("error.generic")
    expect(refundErrorKey(null)).toBe("error.generic")
  })

  it("reads the server’s refusal code, and falls back for anything else", () => {
    const refused = (code: string) =>
      new CombinedGraphQLErrors({
        errors: [
          {
            message: "Validation failed",
            extensions: {
              error_code: "VALIDATION_ERROR",
              validation_errors: [
                { field: "payment_intent_id", code, messages: ["x"] },
              ],
            },
          },
        ],
      })
    expect(refusalKey(refused("ORDER_STILL_OPEN"))).toBe(
      "refusal.ORDER_STILL_OPEN",
    )
    expect(refusalKey(refused("REFUND_IN_PROGRESS"))).toBe(
      "refusal.REFUND_IN_PROGRESS",
    )
    expect(refusalKey(refused("SOMETHING_NEW"))).toBe("refusal.generic")
    expect(refusalKey(new Error("Failed to fetch"))).toBe("refusal.generic")
  })

  it("reads a reason the server invents as other", () => {
    expect(unappliedReasonKey("duplicate_charge")).toBe("duplicate_charge")
    expect(unappliedReasonKey("something_new")).toBe("other")
  })
})
