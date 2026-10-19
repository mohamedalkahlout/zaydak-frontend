import { describe, expect, it } from "vitest"

import { commissionSchema, hasAtMostTwoDecimals } from "../validations"

const base = {
  level: "Gold",
  sub_level: "",
  description: "",
  language: "en",
  min_balance: 0,
  max_balance: 1000,
  commission: 2.5,
}

describe("hasAtMostTwoDecimals", () => {
  it.each([0, 1, 2.5, 2.55, 100, 0.01, 12.34])("accepts %s", (n) => {
    expect(hasAtMostTwoDecimals(n)).toBe(true)
  })

  it.each([2.555, 0.001, 1.2345])("rejects %s", (n) => {
    expect(hasAtMostTwoDecimals(n)).toBe(false)
  })

  it("survives binary floating point — 2.55 * 100 is not exactly 255", () => {
    expect(2.55 * 100).not.toBe(255)
    expect(hasAtMostTwoDecimals(2.55)).toBe(true)
  })

  it("rejects non-finite values", () => {
    expect(hasAtMostTwoDecimals(Number.NaN)).toBe(false)
    expect(hasAtMostTwoDecimals(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe("commissionSchema", () => {
  it("accepts a well-formed tier", () => {
    expect(commissionSchema.safeParse(base).success).toBe(true)
  })

  it("accepts a null max_balance as an open-ended top tier", () => {
    expect(
      commissionSchema.safeParse({ ...base, max_balance: null }).success,
    ).toBe(true)
  })

  it("requires a level and a language", () => {
    expect(commissionSchema.safeParse({ ...base, level: "" }).success).toBe(false)
    expect(commissionSchema.safeParse({ ...base, language: "" }).success).toBe(
      false,
    )
    expect(commissionSchema.safeParse({ ...base, level: "   " }).success).toBe(
      false,
    )
  })

  it("rejects a commission above 100% or below zero", () => {
    expect(commissionSchema.safeParse({ ...base, commission: 101 }).success).toBe(
      false,
    )
    expect(commissionSchema.safeParse({ ...base, commission: -1 }).success).toBe(
      false,
    )
  })

  it("rejects precision the back-end would silently round away", () => {
    // bpsOf(2.555) = round(255.5) = 256 → the admin typed 2.555%, gets 2.56%.
    const result = commissionSchema.safeParse({ ...base, commission: 2.555 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain("2 decimal places")
  })

  it("requires max_balance to exceed min_balance", () => {
    const result = commissionSchema.safeParse({
      ...base,
      min_balance: 500,
      max_balance: 500,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["max_balance"])
  })

  it("does not compare an open-ended ceiling against the minimum", () => {
    expect(
      commissionSchema.safeParse({
        ...base,
        min_balance: 9999,
        max_balance: null,
      }).success,
    ).toBe(true)
  })

  it("rejects a negative minimum balance", () => {
    expect(commissionSchema.safeParse({ ...base, min_balance: -1 }).success).toBe(
      false,
    )
  })
})
