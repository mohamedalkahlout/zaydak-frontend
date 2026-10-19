import { describe, expect, it } from "vitest"
import { centsToMajor } from "@/shared/lib/format"
import {
  formatLimit,
  hasAtMostTwoDecimals,
  parseLimit,
  planSchema,
  toCents,
} from "../validations"

const valid = {
  code: "grow",
  name: "Grow",
  monthly_price: 299,
  yearly_price: 2990,
  currency: "SAR",
  trial_days: 14,
  is_public: true,
}

describe("planSchema", () => {
  it("accepts a well-formed plan", () => {
    expect(planSchema.safeParse(valid).success).toBe(true)
  })

  it("mirrors the server's slug rule on code", () => {
    // The server locks this shape and refuses to rename it afterwards — it is
    // the handle the seed and the fallback lookup key on. Catching it here
    // means the admin finds out before submitting.
    for (const code of ["Grow", "my plan", "grow!", "-grow", ""]) {
      expect(planSchema.safeParse({ ...valid, code }).success).toBe(false)
    }
    for (const code of ["grow", "grow-2", "grow_2", "plus3"]) {
      expect(planSchema.safeParse({ ...valid, code }).success).toBe(true)
    }
  })

  it("rejects a third decimal place instead of letting it be rounded away", () => {
    // toCents rounds, so 29.999 would silently save as 30.00.
    expect(planSchema.safeParse({ ...valid, monthly_price: 29.999 }).success).toBe(false)
    expect(planSchema.safeParse({ ...valid, monthly_price: 29.99 }).success).toBe(true)
  })

  it("rejects negative prices and fractional trial days", () => {
    expect(planSchema.safeParse({ ...valid, monthly_price: -1 }).success).toBe(false)
    expect(planSchema.safeParse({ ...valid, trial_days: 1.5 }).success).toBe(false)
  })
})

describe("money conversion", () => {
  it("round-trips through cents", () => {
    for (const major of [0, 1, 29.99, 299, 4999.5]) {
      expect(centsToMajor(toCents(major))).toBeCloseTo(major, 10)
    }
  })

  it("handles the binary floating point case", () => {
    // 2.55 * 100 is 254.99999999999997, not 255.
    expect(hasAtMostTwoDecimals(2.55)).toBe(true)
    expect(toCents(2.55)).toBe(255)
  })

  it("rejects a non-finite value rather than passing NaN to the server", () => {
    expect(hasAtMostTwoDecimals(Number.NaN)).toBe(false)
    expect(hasAtMostTwoDecimals(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe("parseLimit", () => {
  it("reads an empty box as unlimited, not zero", () => {
    // null and 0 are different answers the server treats differently: null is
    // no ceiling, 0 is an allowance of none.
    expect(parseLimit("")).toBeNull()
    expect(parseLimit("   ")).toBeNull()
    expect(parseLimit("0")).toBe(0)
  })

  it("accepts whole numbers", () => {
    expect(parseLimit("200")).toBe(200)
    expect(parseLimit(" 1000 ")).toBe(1000)
  })

  it("returns undefined for input the admin must fix", () => {
    // Signalled rather than coerced: writing an unparseable limit as 0 would
    // cap a capability the admin meant to leave unlimited.
    for (const raw of ["abc", "-5", "1.5", "1e5", "١٠٠"]) {
      expect(parseLimit(raw)).toBeUndefined()
    }
  })

  it("refuses a number past the safe integer range", () => {
    expect(parseLimit("99999999999999999999")).toBeUndefined()
  })
})

describe("formatLimit", () => {
  it("shows unlimited as an empty box, never as 0", () => {
    expect(formatLimit(null)).toBe("")
    expect(formatLimit(undefined)).toBe("")
    expect(formatLimit(0)).toBe("0")
    expect(formatLimit(200)).toBe("200")
  })

  it("round-trips with parseLimit", () => {
    for (const limit of [null, 0, 1, 200, 5000]) {
      expect(parseLimit(formatLimit(limit))).toBe(limit)
    }
  })
})
