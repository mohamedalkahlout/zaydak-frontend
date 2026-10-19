import { describe, expect, it } from "vitest"

import {
  codeLengthFrom,
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyOtpSchemaFor,
} from "../validations"

const VALID_PASSWORD = "Str0ng!pass"

describe("loginSchema", () => {
  it("accepts an identifier and a password", () => {
    expect(
      loginSchema.safeParse({ identifier: "a@b.com", password: "x" }).success,
    ).toBe(true)
  })

  it("rejects blanks — the back-end never sees an empty credential", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "x" }).success).toBe(
      false,
    )
    expect(
      loginSchema.safeParse({ identifier: "a@b.com", password: "" }).success,
    ).toBe(false)
  })
})

/**
 * The code's length is what the send said it issued — 4 to 8, an admin's
 * setting or a Verify service's own — so the schema is built per code.
 */
describe("verifyOtpSchemaFor", () => {
  it("accepts exactly six digits when built for six", () => {
    expect(verifyOtpSchemaFor(6).safeParse({ code: "012345" }).success).toBe(
      true,
    )
  })

  it.each(["12345", "1234567", "12345a", "  1234"])(
    "rejects %j for six",
    (code) => {
      expect(verifyOtpSchemaFor(6).safeParse({ code }).success).toBe(false)
    },
  )

  it("takes exactly four digits when built for four, and eight for eight", () => {
    expect(verifyOtpSchemaFor(4).safeParse({ code: "0123" }).success).toBe(true)
    expect(verifyOtpSchemaFor(4).safeParse({ code: "012" }).success).toBe(false)
    expect(verifyOtpSchemaFor(4).safeParse({ code: "01234" }).success).toBe(
      false,
    )
    expect(
      verifyOtpSchemaFor(8).safeParse({ code: "01234567" }).success,
    ).toBe(true)
  })
})

describe("codeLengthFrom", () => {
  it.each([4, 5, 6, 7, 8])("passes %i through", (length) => {
    expect(codeLengthFrom(length)).toBe(length)
  })

  it.each([undefined, null, 3, 9, 6.5, Number.NaN, "4"])(
    "falls back to six for %j",
    (raw) => {
      expect(codeLengthFrom(raw)).toBe(6)
    },
  )
})

describe("sendOtpSchema / forgotPasswordSchema", () => {
  it("both require a non-empty identifier", () => {
    expect(sendOtpSchema.safeParse({ identifier: "" }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ identifier: "" }).success).toBe(false)
    expect(sendOtpSchema.safeParse({ identifier: "+966500000000" }).success).toBe(
      true,
    )
  })
})

describe("resetPasswordSchema", () => {
  const base = {
    identifier: "a@b.com",
    code: "123456",
    password: VALID_PASSWORD,
    password_confirmation: VALID_PASSWORD,
  }

  it("accepts a policy-compliant password", () => {
    expect(resetPasswordSchema.safeParse(base).success).toBe(true)
  })

  it.each([
    ["0123", true],
    ["01234567", true],
    ["012", false],
    ["012345678", false],
    ["12a4", false],
  ])("takes the code %j: %s", (code, ok) => {
    expect(resetPasswordSchema.safeParse({ ...base, code }).success).toBe(ok)
  })

  it.each([
    ["too short", "Sh0rt!"],
    ["no uppercase", "str0ng!pass"],
    ["no lowercase", "STR0NG!PASS"],
    ["no digit", "Strong!pass"],
    ["no special character", "Str0ngpass"],
  ])("rejects a password with %s", (_label, password) => {
    const result = resetPasswordSchema.safeParse({
      ...base,
      password,
      password_confirmation: password,
    })
    expect(result.success).toBe(false)
  })

  it("flags a confirmation mismatch on password_confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      ...base,
      password_confirmation: "Different1!",
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["password_confirmation"])
  })
})

describe("newPasswordSchema", () => {
  const VALID_PASSWORD = "Str0ng!pass"

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
