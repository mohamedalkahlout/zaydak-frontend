import { describe, expect, it } from "vitest"

import {
  OTP_RETENTION_DAYS,
  earliestSelectableDate,
  endOfDayIso,
  isValidRange,
  latestSelectableDate,
  startOfDayIso,
  toDateInputValue,
} from "../range"

const DAY_MS = 86_400_000

describe("toDateInputValue", () => {
  it("renders the local date, zero-padded", () => {
    expect(toDateInputValue(new Date(2026, 7, 3, 13, 45))).toBe("2026-08-03")
  })
})

describe("earliestSelectableDate", () => {
  it("is exactly the retention window back from now", () => {
    // The bound is not a preference — rows older than this are already deleted
    // by the cleanup job, so anything earlier would return nothing.
    const now = new Date(2026, 7, 14, 9, 0)
    expect(earliestSelectableDate(now)).toBe(
      toDateInputValue(new Date(now.getTime() - OTP_RETENTION_DAYS * DAY_MS)),
    )
    expect(earliestSelectableDate(now)).toBe("2026-07-31")
  })

  it("mirrors the back-end's fourteen days", () => {
    expect(OTP_RETENTION_DAYS).toBe(14)
  })
})

describe("latestSelectableDate", () => {
  it("is today — there are no codes from tomorrow", () => {
    const now = new Date(2026, 7, 14, 23, 30)
    expect(latestSelectableDate(now)).toBe("2026-08-14")
  })
})

describe("isValidRange", () => {
  it("accepts an empty pair", () => {
    expect(isValidRange("", "")).toBe(true)
  })

  it("accepts a half-filled pair — either bound stands on its own", () => {
    expect(isValidRange("2026-08-01", "")).toBe(true)
    expect(isValidRange("", "2026-08-01")).toBe(true)
  })

  it("accepts a single day", () => {
    expect(isValidRange("2026-08-01", "2026-08-01")).toBe(true)
  })

  it("accepts an ordered pair", () => {
    expect(isValidRange("2026-08-01", "2026-08-14")).toBe(true)
  })

  it("refuses an inverted pair", () => {
    // The server would answer this with an empty list, which reads as "no codes
    // were sent" rather than "you typed it backwards".
    expect(isValidRange("2026-08-14", "2026-08-01")).toBe(false)
  })
})

describe("startOfDayIso / endOfDayIso", () => {
  it("opens at the first instant of the local day", () => {
    const start = new Date(startOfDayIso("2026-08-03"))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getDate()).toBe(3)
  })

  it("closes at the last instant of the same local day", () => {
    const end = new Date(endOfDayIso("2026-08-03"))
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
    expect(end.getDate()).toBe(3)
  })

  it("spans one whole day, so an inclusive server bound covers it exactly", () => {
    const start = new Date(startOfDayIso("2026-08-03")).getTime()
    const end = new Date(endOfDayIso("2026-08-03")).getTime()
    expect(end - start).toBe(DAY_MS - 1)
  })

  it("emits ISO instants, which is what the DateTime scalar wants", () => {
    expect(startOfDayIso("2026-08-03")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
  })
})
