import { describe, expect, it } from "vitest"

import { DOUGHN_CONTENT } from "../content"
import { monotoneCurve, ramp, smooth } from "../lib/motion"
import { BASKETS, CURTAIN_H, INTERIOR_K } from "../scene/geometry"
import { loafLayout, slatLayout } from "../scene/layout"
import { BEAT, storyMinutes } from "../scene/street-scene"

describe("storyMinutes", () => {
  it("holds at 4:00, then runs to 6:00 by the end of the walk", () => {
    expect(storyMinutes(0)).toBe(240)
    expect(storyMinutes(BEAT.hold / 2)).toBe(240)
    expect(storyMinutes(BEAT.dawnFrom)).toBeCloseTo(260)
    expect(storyMinutes(BEAT.dawnTo)).toBeCloseTo(352)
    expect(storyMinutes(BEAT.walkEnd)).toBeCloseTo(360)
    expect(storyMinutes(1)).toBe(360)
  })

  it("never runs backwards", () => {
    let last = 0
    for (let p = 0; p <= 1; p += 0.001) {
      const m = storyMinutes(p)
      expect(m).toBeGreaterThanOrEqual(last)
      last = m
    }
  })
})

describe("monotoneCurve", () => {
  const knots: [number, number][] = [
    [0, 0],
    [0.02807, 0.037],
    [0.1885, 0.24],
    [0.2607, 0.36],
    [1, 1],
  ]
  const curve = monotoneCurve(knots, { 3: 0.8656, 4: 0.8656 })

  it("passes through every knot", () => {
    for (const [x, y] of knots) expect(curve(x)).toBeCloseTo(y, 6)
  })

  it("never runs backwards between them", () => {
    let last = -1
    for (let x = 0; x <= 1; x += 0.0005) {
      const y = curve(x)
      expect(y).toBeGreaterThanOrEqual(last - 1e-12)
      last = y
    }
  })
})

describe("ramp and smooth", () => {
  it("clamp to 0..1", () => {
    expect(ramp(0.2, 0.4, 0.1)).toBe(0)
    expect(ramp(0.2, 0.4, 0.3)).toBeCloseTo(0.5)
    expect(ramp(0.2, 0.4, 0.9)).toBe(1)
    expect(smooth(0.5)).toBe(0.5)
  })
})

describe("slatLayout", () => {
  it("cuts the whole curtain into touching strips", () => {
    const slats = slatLayout()
    expect(slats[0].y0).toBe(0)
    for (let i = 1; i < slats.length; i++) expect(slats[i].y0).toBe(slats[i - 1].y0 + slats[i - 1].h)
    const last = slats[slats.length - 1]
    expect(last.y0 + last.h).toBe(CURTAIN_H)
    expect(slats.filter((s) => s.last)).toEqual([last])
  })
})

describe("loafLayout", () => {
  const ids = DOUGHN_CONTENT.items.map((item) => item.id)

  it("puts one bread in each basket, its bottom inside the front rim", () => {
    const loaves = loafLayout(ids)
    expect(loaves).toHaveLength(BASKETS.length)
    loaves.forEach((loaf, i) => {
      const [, bcy, , bry] = BASKETS[i]
      const rimY = bcy * INTERIOR_K
      const bottom = loaf.y + loaf.h
      expect(bottom).toBeGreaterThan(rimY)
      expect(bottom).toBeLessThan(rimY + bry * INTERIOR_K)
      expect(loaf.clip).toMatch(/^path\('M0 0 H[\d.]+ V[\d.]+ H[\d.]+ A[\d.]+ [\d.]+ 0 0 1 [\d.]+ [\d.]+ H0 Z'\)$/)
    })
  })
})

describe("DOUGHN_CONTENT", () => {
  it("has a bread for every basket", () => {
    expect(DOUGHN_CONTENT.items).toHaveLength(BASKETS.length)
  })

  it("keeps the captions on the same story minutes in both languages", () => {
    const at = (lang: "en" | "ar") => DOUGHN_CONTENT.copy[lang].caps.map(([minute]) => minute)
    expect(at("ar")).toEqual(at("en"))
  })
})
