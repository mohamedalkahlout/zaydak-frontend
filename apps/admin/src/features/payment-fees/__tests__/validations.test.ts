import { describe, expect, it } from "vitest"
import { createTranslator } from "next-intl"

import en from "@/shared/messages/en.json"
import { findFee, isEditableFee, MAX_FEE_PERCENT } from "../types"
import {
  paymentFeeSchema,
  toFormValues,
  toUpsertInput,
  type Translate,
} from "../validations"

/**
 * The fee form's rules and its money boundary. The server holds the same rules
 * (`UpsertPaymentGatewayFeeInput`, `PaymentGatewayFeesService.upsert`); these
 * are here so an admin finds out before saving, and so the percent and the
 * major units a person types reach the API as the basis points and cents it
 * stores, in exactly one place.
 */

const t = createTranslator({
  locale: "en",
  messages: en,
  namespace: "paymentFees",
}) as unknown as Translate

const schema = paymentFeeSchema(t)

const base = {
  gateway: "STRIPE",
  currency: "SAR",
  percent: 2.9,
  fixed: 1,
  cap: null,
  active: true,
}

const issue = (values: Record<string, unknown>) => {
  const result = schema.safeParse({ ...base, ...values })
  return result.success
    ? null
    : {
        path: result.error.issues[0].path.join("."),
        message: result.error.issues[0].message,
      }
}

describe("paymentFeeSchema", () => {
  it("accepts a fee with no cap, with a cap, and switched off", () => {
    expect(issue({})).toBeNull()
    expect(issue({ cap: 50 })).toBeNull()
    expect(issue({ active: false })).toBeNull()
    expect(issue({ percent: 0, fixed: 0 })).toBeNull()
  })

  it("requires a payment method", () => {
    expect(issue({ gateway: "" })).toEqual({
      path: "gateway",
      message: "Choose a payment method",
    })
  })

  it("takes a three-letter currency in either case", () => {
    expect(issue({ currency: "sar" })).toBeNull()
    expect(issue({ currency: " AED " })).toBeNull()
    for (const currency of ["SA", "SARR", "S1R", ""]) {
      expect(issue({ currency })).toEqual({
        path: "currency",
        message: "Enter a three-letter currency code, for example SAR",
      })
    }
  })

  it("caps the percentage where the server does, so 29 typed for 2.9 is refused", () => {
    expect(MAX_FEE_PERCENT).toBe(20)
    expect(issue({ percent: 20 })).toBeNull()
    expect(issue({ percent: 20.01 })).toEqual({
      path: "percent",
      message: "The percentage cannot exceed 20%",
    })
    expect(issue({ percent: 29 })?.path).toBe("percent")
  })

  it("refuses a negative amount and a third decimal place, naming the field", () => {
    expect(issue({ percent: -1 })).toEqual({
      path: "percent",
      message: "Percentage cannot be negative",
    })
    expect(issue({ fixed: -0.5 })).toEqual({
      path: "fixed",
      message: "Fixed fee cannot be negative",
    })
    expect(issue({ percent: 2.955 })).toEqual({
      path: "percent",
      message: "Percentage cannot have more than 2 decimal places",
    })
    expect(issue({ fixed: 1.005 })).toEqual({
      path: "fixed",
      message: "Fixed fee cannot have more than 2 decimal places",
    })
    expect(issue({ cap: 10.001 })?.path).toBe("cap")
  })

  it("refuses an empty number field instead of reading it as zero", () => {
    // `valueAsNumber` hands the schema NaN for a cleared input.
    expect(issue({ percent: Number.NaN })).toEqual({
      path: "percent",
      message: "Percentage must be a number",
    })
    expect(issue({ fixed: Number.NaN })?.path).toBe("fixed")
  })

  it("refuses a cap below the fixed fee, and accepts one equal to it", () => {
    expect(issue({ fixed: 5, cap: 4.99 })).toEqual({
      path: "cap",
      message: "The cap cannot be below the fixed fee",
    })
    expect(issue({ fixed: 5, cap: 5 })).toBeNull()
  })
})

describe("toUpsertInput — the write boundary", () => {
  it("sends basis points and integer cents, never a percent or major units", () => {
    expect(toUpsertInput({ ...base, percent: 2.9, fixed: 1, cap: 50 })).toEqual(
      {
        gateway: "STRIPE",
        currency: "SAR",
        fee_bps: 290,
        fee_fixed_cents: 100,
        fee_cap_cents: 5000,
        active: true,
      },
    )
  })

  it("survives binary floating point: 2.55% is 255 bps, 0.29 is 29 cents", () => {
    expect(2.55 * 100).not.toBe(255)
    const input = toUpsertInput({ ...base, percent: 2.55, fixed: 0.29 })
    expect(input.fee_bps).toBe(255)
    expect(input.fee_fixed_cents).toBe(29)
  })

  it("sends no cap as null, which clears one the fee had", () => {
    expect(toUpsertInput({ ...base, cap: null }).fee_cap_cents).toBeNull()
    expect(toUpsertInput({ ...base, cap: 0 }).fee_cap_cents).toBe(0)
  })

  it("sends the currency in upper case, the only form the API takes", () => {
    expect(toUpsertInput({ ...base, currency: " aed " }).currency).toBe("AED")
  })

  it("sends a cash-on-delivery fee as a flat amount and a switched-off fee as off", () => {
    expect(
      toUpsertInput({
        gateway: "CASH_ON_DELIVERY",
        currency: "SAR",
        percent: 0,
        fixed: 5,
        cap: null,
        active: false,
      }),
    ).toEqual({
      gateway: "CASH_ON_DELIVERY",
      currency: "SAR",
      fee_bps: 0,
      fee_fixed_cents: 500,
      fee_cap_cents: null,
      active: false,
    })
  })
})

describe("toFormValues — the read boundary", () => {
  const row = {
    __typename: "PaymentGatewayFeeEntry" as const,
    id: "fee_1",
    gateway: "STRIPE",
    currency: "SAR",
    fee_bps: 290,
    fee_fixed_cents: 100,
    fee_cap_cents: 5000,
    active: false,
    updated_at: "2026-10-04T00:00:00.000Z",
  }

  it("opens a row in a percent and major units", () => {
    expect(toFormValues(row, { gateway: "", currency: "SAR" })).toEqual({
      gateway: "STRIPE",
      currency: "SAR",
      percent: 2.9,
      fixed: 1,
      cap: 50,
      active: false,
    })
  })

  it("keeps no cap as no cap, not zero", () => {
    expect(
      toFormValues(
        { ...row, fee_cap_cents: null },
        { gateway: "", currency: "SAR" },
      ).cap,
    ).toBeNull()
  })

  it("starts a new fee empty, charged, in the currency it was given", () => {
    expect(toFormValues(null, { gateway: "", currency: "AED" })).toEqual({
      gateway: "",
      currency: "AED",
      percent: 0,
      fixed: 0,
      cap: null,
      active: true,
    })
  })

  it("round-trips a row through the form unchanged", () => {
    const {
      gateway,
      currency,
      fee_bps,
      fee_fixed_cents,
      fee_cap_cents,
      active,
    } = row
    expect(
      toUpsertInput(toFormValues(row, { gateway: "", currency: "SAR" })),
    ).toEqual({
      gateway,
      currency,
      fee_bps,
      fee_fixed_cents,
      fee_cap_cents,
      active,
    })
  })
})

describe("schedule helpers", () => {
  const rows = [
    { gateway: "STRIPE", currency: "SAR" },
    { gateway: "STRIPE", currency: "AED" },
    { gateway: "TABBY", currency: "SAR" },
  ]

  it("finds the fee a new one would replace, whatever case was typed", () => {
    expect(findFee(rows, "STRIPE", "aed")).toBe(rows[1])
    expect(findFee(rows, "STRIPE", " sar ")).toBe(rows[0])
    expect(findFee(rows, "CASH_ON_DELIVERY", "SAR")).toBeUndefined()
    expect(findFee(rows, "", "SAR")).toBeUndefined()
  })

  it("edits only a fee whose payment method the API accepts", () => {
    const gateways = ["STRIPE", "CASH_ON_DELIVERY"]
    expect(isEditableFee(rows[0], gateways)).toBe(true)
    expect(isEditableFee(rows[2], gateways)).toBe(false)
  })
})
