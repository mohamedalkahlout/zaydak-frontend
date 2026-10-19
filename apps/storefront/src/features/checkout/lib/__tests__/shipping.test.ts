import { describe, expect, it } from "vitest"

import { cartNeedsShipping, isDigitalOnlyOrder, lineShips } from "../shipping"

const physical = { requires_shipping: true, product_type: "SIMPLE" }
const optedOut = { requires_shipping: false, product_type: "SIMPLE" }

/**
 * The case this exists for: a `DIGITAL` product whose `requires_shipping` is
 * still `true`. The column defaults true server-side and is not cleared when a
 * vendor marks a product digital, so this is the *common* shape of a digital
 * row — not an edge case. Reading `requires_shipping` alone asked a customer
 * buying a course for a delivery address, then blocked checkout on it.
 */
const digitalWithStaleFlag = { requires_shipping: true, product_type: "DIGITAL" }
const digital = { requires_shipping: false, product_type: "DIGITAL" }

/**
 * Why the predicate is keyed on `product_type` and NOT `is_digital`: boxed
 * software is `SIMPLE` + `is_digital` — a physical parcel carrying digital
 * content — and it ships. The old `is_digital` predicate hid the address form
 * for it while the server rightly charged to deliver the box, so the customer
 * was billed for shipping to an address they were never asked for.
 */
const boxedSoftware = { requires_shipping: true, product_type: "SIMPLE" }

describe("lineShips", () => {
  it("ships a physical product", () => {
    expect(lineShips(physical)).toBe(true)
  })

  it("does not ship a digital product whose flag was cleared", () => {
    expect(lineShips(digital)).toBe(false)
  })

  it("does not ship a digital product whose flag is still set", () => {
    expect(lineShips(digitalWithStaleFlag)).toBe(false)
  })

  it("ships boxed software — SIMPLE type, whatever is_digital says", () => {
    expect(lineShips(boxedSoftware)).toBe(true)
  })

  it("honours a vendor opting a physical product out of shipping", () => {
    expect(lineShips(optedOut)).toBe(false)
  })

  it("ships a VARIABLE product like a SIMPLE one", () => {
    expect(
      lineShips({ requires_shipping: true, product_type: "VARIABLE" }),
    ).toBe(true)
  })
})

describe("cartNeedsShipping", () => {
  it("is false for a digital-only cart", () => {
    expect(cartNeedsShipping([digitalWithStaleFlag, digital])).toBe(false)
  })

  it("is true as soon as one line ships", () => {
    expect(cartNeedsShipping([digitalWithStaleFlag, physical])).toBe(true)
  })

  it("is true for an all-physical cart", () => {
    expect(cartNeedsShipping([physical, physical])).toBe(true)
  })

  it("is false for an empty cart", () => {
    expect(cartNeedsShipping([])).toBe(false)
  })
})

describe("isDigitalOnlyOrder", () => {
  it("is true when every orderable line is digital", () => {
    expect(isDigitalOnlyOrder([digital, digitalWithStaleFlag])).toBe(true)
  })

  it("is false when a physical line is orderable", () => {
    expect(isDigitalOnlyOrder([digital, physical])).toBe(false)
  })

  it("is false when nothing is orderable — blocked lines are not digital", () => {
    // Empty orderable used to trip the digital-only copy while the cart still
    // held a physical product marked unavailable (untracked qty 0).
    expect(isDigitalOnlyOrder([])).toBe(false)
  })
})
