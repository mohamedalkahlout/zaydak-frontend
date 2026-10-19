import { describe, expect, it } from "vitest"
import { createTranslator } from "use-intl/core"
import ar from "@/shared/messages/ar"
import type { Translate } from "@/shared/i18n/translator"
import { enTranslator } from "@/shared/test/next-intl"
import {
  amountOffOrderCouponSchema,
  buyXGetYCouponSchema,
  freeShippingCouponSchema,
} from "../coupon"

/**
 * The schemas are factories over `coupons.validation` now, because a zod
 * message is fixed when the schema is built — a constant schema stayed
 * English under the Arabic dashboard however its errors were rendered. This
 * pins that the English messages read as they always did and that the Arabic
 * catalogue reaches the same refinements.
 */
const tv = enTranslator("coupons.validation")
const tvAr = createTranslator({
  locale: "ar",
  messages: ar as Parameters<typeof createTranslator>[0]["messages"],
  namespace: "coupons.validation" as never,
}) as unknown as Translate

const base = {
  code: "SALE20",
  method: "code",
  active_from_date: "2026-01-01",
  active_from_time: "00:00",
}

function messageAt(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
) {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message
}

describe("coupon schemas", () => {
  it("keeps the English messages", () => {
    const order = amountOffOrderCouponSchema(tv).safeParse({
      ...base,
      type: "amount_off_order",
      value_type: "percentage",
      amount: 150,
    })
    expect(messageAt(order, "amount")).toBe("Cannot exceed 100%")

    const shortCode = amountOffOrderCouponSchema(tv).safeParse({
      ...base,
      code: "A",
      type: "amount_off_order",
      value_type: "fixed",
      amount: 10,
    })
    expect(messageAt(shortCode, "code")).toBe(
      "Code must be at least 2 characters",
    )

    const shipping = freeShippingCouponSchema(tv).safeParse({
      ...base,
      type: "free_shipping",
      countries_mode: "selected",
      countries: [],
    })
    expect(messageAt(shipping, "countries")).toBe("Select at least one country")

    const bogo = buyXGetYCouponSchema(tv).safeParse({
      ...base,
      type: "buy_x_get_y",
      buy_quantity: 0,
      get_quantity: 1,
    })
    expect(messageAt(bogo, "buy_quantity")).toBe("Must be ≥ 1")
  })

  it("builds the same refinements from the Arabic catalogue", () => {
    const shipping = freeShippingCouponSchema(tvAr).safeParse({
      ...base,
      type: "free_shipping",
      countries_mode: "selected",
      countries: [],
    })
    expect(messageAt(shipping, "countries")).toBe("اختر دولة واحدة على الأقل")
  })

  it("accepts a valid coupon", () => {
    const ok = amountOffOrderCouponSchema(tv).safeParse({
      ...base,
      type: "amount_off_order",
      value_type: "percentage",
      amount: 10,
    })
    expect(ok.success).toBe(true)
  })
})
