import { describe, expect, it } from "vitest"

import { enTranslator } from "@/shared/test/next-intl"

import {
  codeLengthFrom,
  newPasswordSchema as newPasswordSchemaFor,
  resetPasswordSchema as resetPasswordSchemaFor,
  verifyOtpSchemaFor as verifyOtpSchemaWith,
} from "../auth"

const VALID_PASSWORD = "Str0ng!pass"

// The schemas are built over a translator; the real English catalogue keeps
// the message assertions meaningful.
const tv = enTranslator("auth.validation")
const newPasswordSchema = newPasswordSchemaFor(tv)
const resetPasswordSchema = resetPasswordSchemaFor(tv)
const verifyOtpSchemaFor = (length: number) => verifyOtpSchemaWith(length, tv)

describe("newPasswordSchema", () => {
  it("accepts matching passwords and has no code field", () => {
    const parsed = newPasswordSchema.safeParse({
      password: VALID_PASSWORD,
      password_confirmation: VALID_PASSWORD,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect("code" in parsed.data).toBe(false)
    }
  })

  it("flags a confirmation mismatch on password_confirmation", () => {
    const result = newPasswordSchema.safeParse({
      password: VALID_PASSWORD,
      password_confirmation: "Different1!",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["password_confirmation"])
  })
})

describe("resetPasswordSchema", () => {
  it("still requires the OTP for the mutation payload", () => {
    expect(
      resetPasswordSchema.safeParse({
        identifier: "a@b.com",
        code: "123456",
        password: VALID_PASSWORD,
        password_confirmation: VALID_PASSWORD,
      }).success,
    ).toBe(true)
    expect(
      resetPasswordSchema.safeParse({
        identifier: "a@b.com",
        password: VALID_PASSWORD,
        password_confirmation: VALID_PASSWORD,
      }).success,
    ).toBe(false)
  })

  it("takes any code length the OTP settings allow, and nothing outside it", () => {
    const withCode = (code: string) =>
      resetPasswordSchema.safeParse({
        identifier: "a@b.com",
        code,
        password: VALID_PASSWORD,
        password_confirmation: VALID_PASSWORD,
      }).success

    expect(withCode("0123")).toBe(true)
    expect(withCode("01234567")).toBe(true)
    expect(withCode("012")).toBe(false)
    expect(withCode("012345678")).toBe(false)
    expect(withCode("12a4")).toBe(false)
  })
})

describe("verifyOtpSchemaFor", () => {
  it("takes exactly the length it was built for", () => {
    const four = verifyOtpSchemaFor(4)
    expect(four.safeParse({ code: "0123" }).success).toBe(true)
    expect(four.safeParse({ code: "012" }).success).toBe(false)
    expect(four.safeParse({ code: "01234" }).success).toBe(false)

    const eight = verifyOtpSchemaFor(8)
    expect(eight.safeParse({ code: "01234567" }).success).toBe(true)
    expect(eight.safeParse({ code: "0123456" }).success).toBe(false)
  })

  it("refuses anything but digits, and says the length it wants", () => {
    const four = verifyOtpSchemaFor(4)
    expect(four.safeParse({ code: "12a4" }).success).toBe(false)
    expect(four.safeParse({ code: "012" }).error?.issues[0]?.message).toBe(
      "Code must be 4 digits",
    )
  })
})

describe("codeLengthFrom", () => {
  it.each([4, 5, 6, 7, 8])("passes %i through", (length) => {
    expect(codeLengthFrom(length)).toBe(length)
  })

  it.each([undefined, null, 3, 9, 6.5, Number.NaN, "4", {}])(
    "falls back to six for %j",
    (raw) => {
      expect(codeLengthFrom(raw)).toBe(6)
    },
  )
})
