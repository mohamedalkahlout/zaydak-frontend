import { describe, expect, it } from "vitest"
import { duplicateCouponCode, duplicateCouponHref } from "../duplicate"

describe("duplicate coupon", () => {
  it("appends COPY and stays within the code limit", () => {
    expect(duplicateCouponCode("SALE20")).toBe("SALE20-COPY")
    expect(duplicateCouponCode("")).toBe("")
    expect(duplicateCouponCode("x".repeat(50))).toHaveLength(50)
    expect(duplicateCouponCode("x".repeat(50)).endsWith("-COPY")).toBe(true)
  })

  it("opens the create form for the coupon's type", () => {
    expect(
      duplicateCouponHref("acme", {
        id: "c1",
        type: "AMOUNT_OFF_ORDER",
      }),
    ).toBe("/store/acme/coupons/new/amount_off_order?from=c1")
  })
})
