import { describe, it, expect } from "vitest"
import { enTranslator } from "@/shared/test/next-intl"
import { formatRelativeTime, formatSampleSecondary } from "../helpers"

describe("formatRelativeTime", () => {
  const t = enTranslator("segments.relativeTime")
  const now = new Date("2026-09-28T12:00:00.000Z")
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const MIN = 60_000

  it("keeps the table's compact English", () => {
    expect(formatRelativeTime(ago(20_000), t, now)).toBe("just now")
    expect(formatRelativeTime(ago(5 * MIN), t, now)).toBe("5m ago")
    expect(formatRelativeTime(ago(3 * 60 * MIN), t, now)).toBe("3h ago")
    expect(formatRelativeTime(ago(2 * 24 * 60 * MIN), t, now)).toBe("2d ago")
    expect(formatRelativeTime(ago(65 * 24 * 60 * MIN), t, now)).toBe("2mo ago")
    expect(formatRelativeTime(ago(800 * 24 * 60 * MIN), t, now)).toBe("2y ago")
  })
})

/**
 * The preview panel's secondary line reads `contacts.email`, the normalised
 * column the server segments, searches and exports on. `meta.email` is only
 * the write path, and a contact whose address exists only in the column must
 * still show it.
 */
describe("formatSampleSecondary", () => {
  it("shows the email column when meta carries none", () => {
    expect(formatSampleSecondary({ email: "sara@example.com", meta: {} })).toBe(
      "sara@example.com",
    )
  })

  it("prefers the column over a differently cased meta copy", () => {
    expect(
      formatSampleSecondary({
        email: "sara@example.com",
        meta: { email: "Sara@Example.com" },
      }),
    ).toBe("sara@example.com")
  })

  it("falls back to the phone, then the city, when there is no email", () => {
    expect(
      formatSampleSecondary({ email: null, phone_number: "+966500000000" }),
    ).toBe("+966500000000")
    expect(
      formatSampleSecondary({
        email: null,
        meta: { default_address: { city: "Riyadh" } },
      }),
    ).toBe("Riyadh")
    expect(formatSampleSecondary({ email: null, meta: null })).toBeNull()
  })
})
