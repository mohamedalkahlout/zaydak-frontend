import { describe, expect, it } from "vitest"
import { createTranslator } from "use-intl/core"
import ar from "@/shared/messages/ar"
import { formatMoneyCents } from "@/shared/lib/format"
import type { Translate } from "@/shared/i18n/translator"
import { enTranslator } from "@/shared/test/next-intl"
import type { Coupon } from "@/features/coupons/types"
import { couponScopeLabel, couponValue } from "../helpers"

/**
 * The list's Value and Scope cells used to be English template strings built
 * in `helpers.ts`. They are messages now. What this pins is that the English
 * still reads exactly as it did — same words, same comma list — and that
 * Arabic gets its own plural forms and list joining rather than an English
 * `s` and `", "`.
 */
const t = enTranslator("coupons")
const tAr = createTranslator({
  locale: "ar",
  messages: ar as Parameters<typeof createTranslator>[0]["messages"],
  namespace: "coupons" as never,
}) as unknown as Translate

function coupon(partial: Partial<Coupon>): Coupon {
  return {
    id: "c1",
    code: "SALE",
    type: "amount_off_products",
    amount_cents: 0,
    active_from: "2026-01-01T00:00:00Z",
    is_valid: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  }
}

describe("couponValue", () => {
  it("reads a percentage, with its cap when there is one", () => {
    expect(
      couponValue(coupon({ value_type: "PERCENTAGE", percent_bps: 2000 }), t),
    ).toBe("20%")
    expect(
      couponValue(
        coupon({
          value_type: "PERCENTAGE",
          percent_bps: 1500,
          max_discount_cents: 5000,
        }),
        t,
      ),
    ).toBe(`15% · up to ${formatMoneyCents(5000)}`)
  })

  it("reads a fixed amount off", () => {
    expect(
      couponValue(coupon({ value_type: "FIXED", amount_cents: 2500 }), t),
    ).toBe(`${formatMoneyCents(2500)} off`)
  })

  it("names free shipping with the create dialog's own label", () => {
    expect(couponValue(coupon({ type: "free_shipping" }), t)).toBe(
      "Free shipping",
    )
  })

  it("folds the BOGO reward into one sentence", () => {
    const bogo = { type: "buy_x_get_y" as const, buy_quantity: 2, get_quantity: 1 }
    expect(couponValue(coupon({ ...bogo, get_discount_type: "FREE" }), t)).toBe(
      "Buy 2 get 1 free",
    )
    expect(
      couponValue(
        coupon({
          ...bogo,
          get_discount_type: "PERCENT",
          get_discount_percent_bps: 5000,
        }),
        t,
      ),
    ).toBe("Buy 2 get 1 (50% off)")
    expect(
      couponValue(
        coupon({
          ...bogo,
          get_discount_type: "PERCENT",
          get_discount_percent_bps: 10000,
        }),
        t,
      ),
    ).toBe("Buy 2 get 1 free")
    expect(
      couponValue(
        coupon({
          ...bogo,
          get_discount_type: "AMOUNT",
          get_discount_amount_cents: 500,
        }),
        t,
      ),
    ).toBe(`Buy 2 get 1 (${formatMoneyCents(500)} off each)`)
    expect(couponValue(coupon(bogo), t)).toBe("Buy 2 get 1")
  })

  it("says it in Arabic under the Arabic catalogue", () => {
    // Digits left loose: which numerals `ar` defaults to depends on the
    // runtime's ICU, and that is not what this pins.
    expect(
      couponValue(
        coupon({
          type: "buy_x_get_y",
          buy_quantity: 2,
          get_quantity: 1,
          get_discount_type: "FREE",
        }),
        tAr,
      ),
    ).toMatch(/^اشترِ \S+ واحصل على \S+ مجانًا$/)
  })
})

describe("couponScopeLabel", () => {
  it("counts each restriction with a real plural and joins them as before", () => {
    expect(couponScopeLabel(coupon({ product_ids: ["p1"] }), t, "en")).toBe(
      "1 product",
    )
    expect(
      couponScopeLabel(
        coupon({ product_ids: ["p1", "p2", "p3"], collection_ids: ["c1", "c2"] }),
        t,
        "en",
      ),
    ).toBe("3 products, 2 collections")
    expect(
      couponScopeLabel(
        coupon({ type: "free_shipping", countries: ["SA", "AE"] }),
        t,
        "en",
      ),
    ).toBe("2 countries")
  })

  it("falls back to the type's own 'everything' label", () => {
    expect(couponScopeLabel(coupon({}), t, "en")).toBe("All products")
    expect(
      couponScopeLabel(coupon({ type: "amount_off_order" }), t, "en"),
    ).toBe("Entire order")
    expect(couponScopeLabel(coupon({ type: "free_shipping" }), t, "en")).toBe(
      "All countries",
    )
  })

  it("uses Arabic plural forms and list joining", () => {
    // `one` and `two` are words in Arabic, so no numerals are involved.
    expect(
      couponScopeLabel(
        coupon({ product_ids: ["p1"], collection_ids: ["c1", "c2"] }),
        tAr,
        "ar",
      ),
    ).toBe("منتج واحد ومجموعتان")
  })
})
