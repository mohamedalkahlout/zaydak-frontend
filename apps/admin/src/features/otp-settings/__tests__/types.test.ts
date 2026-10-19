import { describe, expect, it } from "vitest"

import {
  OTP_LIMITS,
  RECOVERABLE_CODE_LENGTHS,
  clampToLimits,
  isRevealSupported,
} from "../types"

describe("isRevealSupported", () => {
  it("accepts the lengths the reveal can recompute", () => {
    expect(isRevealSupported(4)).toBe(true)
    expect(isRevealSupported(5)).toBe(true)
    expect(isRevealSupported(6)).toBe(true)
  })

  it("refuses the two lengths the server answers OTP_UNRECOVERABLE for", () => {
    // Seven digits is ten million candidates and eight is a hundred, which is
    // no longer something to walk inside a request.
    expect(isRevealSupported(7)).toBe(false)
    expect(isRevealSupported(8)).toBe(false)
  })
})

describe("RECOVERABLE_CODE_LENGTHS", () => {
  it("stays inside the lengths the form can actually produce", () => {
    // The list mirrors a back-end constant across the API boundary; this is
    // what stops it drifting to a value no admin could ever select.
    for (const length of RECOVERABLE_CODE_LENGTHS) {
      expect(length).toBeGreaterThanOrEqual(OTP_LIMITS.code_length.min)
      expect(length).toBeLessThanOrEqual(OTP_LIMITS.code_length.max)
    }
  })

  it("leaves part of the allowed range unsupported, which is why the warning exists", () => {
    const allowed =
      OTP_LIMITS.code_length.max - OTP_LIMITS.code_length.min + 1
    expect(RECOVERABLE_CODE_LENGTHS.length).toBeLessThan(allowed)
  })
})

describe("clampToLimits", () => {
  it("holds a code length inside the bounds the mutation enforces", () => {
    expect(clampToLimits("code_length", 9)).toBe(8)
    expect(clampToLimits("code_length", 1)).toBe(4)
    expect(clampToLimits("code_length", 6)).toBe(6)
  })

  it("truncates rather than rounding — these are integer fields", () => {
    expect(clampToLimits("ttl_seconds", 300.9)).toBe(300)
  })
})

describe("shop_hourly_limit", () => {
  it("is a field the form renders, bounded as the mutation bounds it", () => {
    // UpdateOtpSettingsInput: @Min(1) @Max(1000).
    expect(OTP_LIMITS.shop_hourly_limit).toEqual({ min: 1, max: 1000 })
    expect(clampToLimits("shop_hourly_limit", 0)).toBe(1)
    expect(clampToLimits("shop_hourly_limit", 5000)).toBe(1000)
    expect(clampToLimits("shop_hourly_limit", 45)).toBe(45)
  })
})
