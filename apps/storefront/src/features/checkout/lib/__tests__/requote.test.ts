import { describe, expect, it } from "vitest"

import { needsRequote } from "../requote"

const refusal = (error_code: string) => ({
  errors: [{ message: "x", extensions: { error_code } }],
})

describe("needsRequote", () => {
  it("is true for a total higher than the one confirmed", () => {
    expect(needsRequote(refusal("CHECKOUT_EXPECTATION_FAILED"))).toBe(true)
  })

  it("is true for a negotiated price that lapsed with no confirmed total", () => {
    expect(needsRequote(refusal("NEGOTIATION_OFFER_EXPIRED"))).toBe(true)
  })

  it("is false for anything else, and for a failure with no code", () => {
    expect(needsRequote(refusal("VALIDATION_ERROR"))).toBe(false)
    expect(needsRequote(new Error("Failed to fetch"))).toBe(false)
    expect(needsRequote(undefined)).toBe(false)
  })
})
