import { describe, expect, it } from "vitest"
import { toCsv, toCsvSections } from "../csv"

describe("toCsv", () => {
  it("quotes fields with commas, quotes, and newlines (RFC-4180)", () => {
    const csv = toCsv([{ a: "x,y", b: 'he said "hi"', c: "line\nbreak" }])
    expect(csv).toContain('"x,y"')
    expect(csv).toContain('"he said ""hi"""')
    expect(csv).toContain('"line\nbreak"')
  })

  it("uses the first row's keys as headers and passes plain values through", () => {
    const csv = toCsv([{ Metric: "Orders", Value: 5 }])
    const lines = csv.split("\r\n")
    expect(lines[0]).toBe("Metric,Value")
    expect(lines[1]).toBe("Orders,5")
  })

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("")
  })
})

describe("toCsvSections", () => {
  it("joins titled sections and skips empty ones", () => {
    const out = toCsvSections([
      { title: "Breakdown", rows: [{ Metric: "Net", Value: "$10" }] },
      { title: "Empty", rows: [] },
    ])
    expect(out).toContain("Breakdown")
    expect(out).not.toContain("Empty")
  })
})
