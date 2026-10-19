import { describe, it, expect } from "vitest"
import {
  isEmail,
  isE164,
  normalizePhoneNumber,
  validateContact,
  toWesternDigits,
  sanitizePhone,
} from "../contact-validation"

describe("contact-validation", () => {
  describe("toWesternDigits", () => {
    it("converts Arabic-Indic digits to ASCII digits", () => {
      expect(toWesternDigits("٠٥٠١٢٣٤٥٦٧")).toBe("0501234567")
      expect(toWesternDigits("+٩٦٦٥٠١٢٣٤٥٦٧")).toBe("+966501234567")
    })
  })

  describe("isEmail", () => {
    it("accepts valid standard email addresses", () => {
      expect(isEmail("shopper@example.com")).toBe(true)
      expect(isEmail("first.last@domain.co.uk")).toBe(true)
      expect(isEmail("user+tag@gmail.com")).toBe(true)
      expect(isEmail("ahmed@store.sa")).toBe(true)
    })

    it("rejects invalid emails", () => {
      expect(isEmail("")).toBe(false)
      expect(isEmail("shopper@")).toBe(false)
      expect(isEmail("@example.com")).toBe(false)
      expect(isEmail("shopper@example")).toBe(false)
      expect(isEmail("shopper example.com")).toBe(false)
      expect(isEmail("shopper@.com")).toBe(false)
    })
  })

  describe("isE164", () => {
    it("accepts strict E.164 phone numbers", () => {
      expect(isE164("+966501234567")).toBe(true)
      expect(isE164("+12025550123")).toBe(true)
      expect(isE164("+447911123456")).toBe(true)
      expect(isE164("+971501234567")).toBe(true)
    })

    it("rejects non-E.164 formats", () => {
      expect(isE164("")).toBe(false)
      expect(isE164("0501234567")).toBe(false) // Missing '+'
      expect(isE164("+0501234567")).toBe(false) // Country code cannot start with 0
      expect(isE164("+12345")).toBe(false) // Too short (< 7 digits)
      expect(isE164("+12345678901234567")).toBe(false) // Too long (> 15 digits)
      expect(isE164("+966 50 123 4567")).toBe(false) // Contains spaces
      expect(isE164("+966-50-1234567")).toBe(false) // Contains hyphens
    })
  })

  describe("normalizePhoneNumber", () => {
    it("normalizes Saudi local 10-digit format (05xxxxxxxx)", () => {
      expect(normalizePhoneNumber("0501234567")).toBe("+966501234567")
      expect(normalizePhoneNumber("0554321098")).toBe("+966554321098")
    })

    it("normalizes Saudi local 9-digit format (5xxxxxxxx)", () => {
      expect(normalizePhoneNumber("501234567")).toBe("+966501234567")
    })

    it("normalizes international numbers with 00 prefix", () => {
      expect(normalizePhoneNumber("00966501234567")).toBe("+966501234567")
      expect(normalizePhoneNumber("0012025550123")).toBe("+12025550123")
    })

    it("normalizes numbers with formatted characters (spaces, dashes, parentheses)", () => {
      expect(normalizePhoneNumber("+966 50 123 4567")).toBe("+966501234567")
      expect(normalizePhoneNumber("(050) 123-4567")).toBe("+966501234567")
      expect(normalizePhoneNumber("+1 (202) 555-0123")).toBe("+12025550123")
    })

    it("handles Arabic-Indic digits", () => {
      expect(normalizePhoneNumber("٠٥٠١٢٣٤٥٦٧")).toBe("+966501234567")
      expect(normalizePhoneNumber("+٩٦٦ ٥٠ ١٢٣ ٤٥٦٧")).toBe("+966501234567")
    })

    it("returns null for completely invalid phone numbers", () => {
      expect(normalizePhoneNumber("")).toBeNull()
      expect(normalizePhoneNumber("abc")).toBeNull()
      expect(normalizePhoneNumber("123")).toBeNull()
      expect(normalizePhoneNumber("0000000")).toBeNull()
    })
  })

  describe("validateContact", () => {
    it("identifies and validates email contacts", () => {
      const res = validateContact("User@Domain.COM ")
      expect(res.valid).toBe(true)
      expect(res.type).toBe("email")
      expect(res.normalized).toBe("user@domain.com")
    })

    it("identifies invalid email contacts", () => {
      const res = validateContact("invalid@domain")
      expect(res.valid).toBe(false)
      expect(res.type).toBe("email")
      expect(res.error).toBe("invalid")
    })

    it("identifies and normalizes phone contacts", () => {
      const res = validateContact("050 123 4567")
      expect(res.valid).toBe(true)
      expect(res.type).toBe("phone")
      expect(res.normalized).toBe("+966501234567")
    })

    it("identifies invalid phone contacts", () => {
      const res = validateContact("not-a-contact")
      expect(res.valid).toBe(false)
      expect(res.type).toBeNull()
      expect(res.error).toBe("invalid")
    })

    it("identifies empty contact", () => {
      const res = validateContact("")
      expect(res.valid).toBe(false)
      expect(res.type).toBeNull()
      expect(res.error).toBe("required")
    })
  })
})
