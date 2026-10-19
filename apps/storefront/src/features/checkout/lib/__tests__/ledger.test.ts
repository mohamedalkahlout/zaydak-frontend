import { describe, expect, it } from "vitest"

import { checkoutMoneyRows } from "../ledger"

const labels = {
  subtotal: "Subtotal",
  shipping: "Shipping",
  discount: "Discount",
  tax: "Tax",
}

describe("checkout money rows", () => {
  it("does not call an unpriced delivery free", () => {
    const rows = checkoutMoneyRows({
      needsShipping: true,
      addressReady: true,
      hasQuote: true,
      shippingAvailable: false,
      shippingFeeCents: 0,
      discountCents: 0,
      taxCents: 0,
      subtotal: "40",
      shipping: "0",
      freeLabel: "Free",
      pending: "—",
      discount: "0",
      tax: "0",
      labels,
    })
    expect(rows.find((row) => row.label === "Shipping")?.value).toBe("0")
  })

  it("says free only when the quote priced the destination at zero", () => {
    const rows = checkoutMoneyRows({
      needsShipping: true,
      addressReady: true,
      hasQuote: true,
      shippingAvailable: true,
      shippingFeeCents: 0,
      discountCents: 500,
      taxCents: 100,
      subtotal: "40",
      shipping: "0",
      freeLabel: "Free",
      pending: "—",
      discount: "− 5",
      tax: "1",
      labels,
    })
    expect(rows.map((row) => row.value)).toEqual(["40", "Free", "− 5", "1"])
  })

  it("omits shipping on a digital order and waits for an address", () => {
    const digital = checkoutMoneyRows({
      needsShipping: false,
      addressReady: true,
      hasQuote: true,
      shippingAvailable: true,
      shippingFeeCents: 0,
      discountCents: 0,
      taxCents: 0,
      subtotal: "10",
      shipping: "0",
      freeLabel: "Free",
      pending: "—",
      discount: "0",
      tax: "0",
      labels,
    })
    expect(digital).toEqual([{ label: "Subtotal", value: "10" }])

    const waiting = checkoutMoneyRows({
      needsShipping: true,
      addressReady: false,
      hasQuote: false,
      shippingAvailable: false,
      shippingFeeCents: 0,
      discountCents: 0,
      taxCents: 0,
      subtotal: "10",
      shipping: "0",
      freeLabel: "Free",
      pending: "—",
      discount: "0",
      tax: "0",
      labels,
    })
    expect(waiting[1]).toEqual({ label: "Shipping", value: "—" })
  })
})
