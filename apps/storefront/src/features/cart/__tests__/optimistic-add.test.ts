import { describe, expect, it } from "vitest"

import { optimisticAdd, type CartEnvelope } from "../use-cart"

/**
 * The optimistic `addToCart` is the one place this app predicts a server
 * response, so what it is *allowed* to predict is the thing worth pinning.
 *
 * The rule the storefront is built on is that money is never computed here —
 * `verifyCheckout` and the pricing engine decide what a line costs once
 * discounts, flash sales, automatic coupons and tax have had their say. An item
 * count is a sum of quantities and is safe; a subtotal is not. A future edit
 * that "helpfully" also bumps `subtotal_price_cents` would show the customer a
 * total that then corrects itself, and these tests are what should stop it.
 */

const envelope = (): CartEnvelope =>
  ({
    __typename: "CartEnvelope",
    id: "cart-1",
    shop: {
      __typename: "CartShopInfo",
      id: "shop-1",
      name: "Acme",
      slug: "acme",
      logo: null,
    },
    items: [
      {
        __typename: "CartItemEntry",
        id: "line-1",
        product_id: "prod-1",
        variation_option_id: null,
        name: "Mug",
        variation_name: null,
        slug: "mug",
        image: null,
        quantity: 2,
        unit_price_cents: 1000,
        price_cents: 1000,
        sale_price_cents: null,
        discount_cents: 0,
        total_price_cents: 2000,
        is_variation: false,
        requires_shipping: true,
        is_digital: false,
        status: "AVAILABLE",
        stock_status: "in_stock",
        unavailable_reason: null,
        custom_options: null,
      },
    ],
    summary: {
      __typename: "CartSummary",
      currency: "USD",
      total_items: 2,
      subtotal_price_cents: 2000,
      discount_cents: 150,
      tax_bps: 500,
      total_tax_amount_cents: 92,
      total_price_cents: 1942,
      coupons: [],
    },
  }) as unknown as CartEnvelope

describe("optimisticAdd", () => {
  it("bumps the item count by the quantity added", () => {
    const result = optimisticAdd(envelope(), 3)
    expect(result?.addToCart.data?.summary.total_items).toBe(5)
  })

  it("leaves every money field exactly as the server last reported it", () => {
    const before = envelope()
    const summary = optimisticAdd(before, 3)?.addToCart.data?.summary

    expect(summary?.subtotal_price_cents).toBe(2000)
    expect(summary?.discount_cents).toBe(150)
    expect(summary?.total_tax_amount_cents).toBe(92)
    expect(summary?.total_price_cents).toBe(1942)
    expect(summary?.currency).toBe("USD")
  })

  it("fabricates no line — the server decides what the cart contains", () => {
    // A predicted line would need a price, and there is no honest one to give
    // it: the same product can be worth different amounts once a coupon or a
    // flash window applies to the new quantity.
    const result = optimisticAdd(envelope(), 1)
    const items = result?.addToCart.data?.items

    expect(items).toHaveLength(1)
    expect(items?.[0]?.quantity).toBe(2)
    expect(items?.[0]?.total_price_cents).toBe(2000)
  })

  it("does not mutate the cart it was given", () => {
    // It is handed the object Apollo holds in its cache, which is frozen in
    // development — writing through it would throw there and corrupt the cache
    // everywhere else.
    const before = envelope()
    optimisticAdd(before, 4)
    expect(before.summary.total_items).toBe(2)
  })

  it("returns undefined when there is no cart to predict from", () => {
    // Apollo reads a missing `optimisticResponse` as "just wait for the
    // server", which is the right behaviour on a visitor's very first add.
    expect(optimisticAdd(null, 1)).toBeUndefined()
  })

  it("keeps the typenames Apollo needs to normalize the write", () => {
    const result = optimisticAdd(envelope(), 1)
    expect(result?.addToCart.__typename).toBe("CartResponse")
    expect(result?.addToCart.data?.__typename).toBe("CartEnvelope")
    // `CartEnvelope` is keyed on `id` in the cache; without it the optimistic
    // write lands on a different entity than the query reads.
    expect(result?.addToCart.data?.id).toBe("cart-1")
  })
})
