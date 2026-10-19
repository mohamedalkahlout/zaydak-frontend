import { describe, expect, it } from "vitest"

import { bakeStatus, clockText, countdownText } from "../lib/clock"

const HOURS = { open: 240, close: 780 }

describe("clockText", () => {
  it("writes minutes after midnight as h:mm", () => {
    expect(clockText(240)).toBe("4:00")
    expect(clockText(250.4)).toBe("4:10")
    expect(clockText(780)).toBe("13:00")
  })

  it("wraps round the day", () => {
    expect(clockText(1440 + 65)).toBe("1:05")
    expect(clockText(-30)).toBe("23:30")
  })
})

describe("countdownText", () => {
  it("writes minutes as hh:mm:ss and never goes below zero", () => {
    expect(countdownText(90.5)).toBe("01:30:30")
    expect(countdownText(-5)).toBe("00:00:00")
  })
})

describe("bakeStatus", () => {
  const tamees = [250, 315, 390]

  it("names tomorrow's first batch while the shop is shut", () => {
    expect(bakeStatus(tamees, 200, HOURS)).toEqual(["tomorrow", 250])
    expect(bakeStatus(tamees, 780, HOURS)).toEqual(["tomorrow", 250])
  })

  it("is in the oven up to twelve minutes before a batch", () => {
    expect(bakeStatus(tamees, 240, HOURS)).toEqual(["oven", 250])
    expect(bakeStatus(tamees, 303, HOURS)).toEqual(["oven", 315])
  })

  it("is warm for 45 minutes after a batch, then fresh", () => {
    expect(bakeStatus(tamees, 260, HOURS)).toEqual(["warm", 250])
    expect(bakeStatus(tamees, 296, HOURS)).toEqual(["fresh", 250])
  })

  it("names the coming batch before the first one is out", () => {
    expect(bakeStatus([450], 300, HOURS)).toEqual(["later", 450])
  })
})
