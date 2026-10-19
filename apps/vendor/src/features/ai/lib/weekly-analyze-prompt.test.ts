import { describe, expect, it } from "vitest"

import { weeklyAnalyzePrompt } from "./weekly-analyze-prompt"

/** The card's 14 shop-local days, 2026-09-17 to 2026-09-30. */
const DAILY = Array.from({ length: 14 }, (_, i) => ({
  day: `2026-09-${String(17 + i).padStart(2, "0")}`,
}))

describe("weeklyAnalyzePrompt", () => {
  it("names the card's own two weeks as dates, in English", () => {
    expect(weeklyAnalyzePrompt(DAILY, false)).toBe(
      "Analyze my sales from 2026-09-24 to 2026-09-30 and compare them with 2026-09-17 to 2026-09-23",
    )
  })

  it("names the same two weeks in Arabic", () => {
    expect(weeklyAnalyzePrompt(DAILY, true)).toBe(
      "حلّل مبيعاتي من 2026-09-24 إلى 2026-09-30 وقارنها بالفترة من 2026-09-17 إلى 2026-09-23",
    )
  })

  it("falls back to the plain question when the series is not two weeks", () => {
    expect(weeklyAnalyzePrompt(DAILY.slice(0, 7), false)).toBe(
      "Analyze the last 7 days and compare with the prior week",
    )
    expect(weeklyAnalyzePrompt([], true)).toBe(
      "حلّل أداء آخر 7 أيام وقارن بالأسبوع اللي قبله",
    )
  })
})
