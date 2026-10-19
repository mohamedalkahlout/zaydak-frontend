import { describe, expect, it } from "vitest"
import { formatAutoscaleNumber } from "../autoscale-input"

describe("formatAutoscaleNumber", () => {
  it("groups US style with a dot decimal", () => {
    expect(formatAutoscaleNumber("1234567.89", "us")).toBe("1,234,567.89")
  })

  it("groups EU style with a comma decimal", () => {
    expect(formatAutoscaleNumber("1234567,89", "eu")).toBe("1.234.567,89")
  })

  it("groups Swiss style with an apostrophe", () => {
    expect(formatAutoscaleNumber("1234567.89", "ch")).toBe("1'234'567.89")
  })

  it("uses lakh grouping for the Indian format", () => {
    expect(formatAutoscaleNumber("1234567.89", "in")).toBe("12,34,567.89")
  })

  it("does not group when format is none", () => {
    expect(formatAutoscaleNumber("1234567.89", "none")).toBe("1234567.89")
  })

  it("passes free text through unchanged in string mode", () => {
    expect(formatAutoscaleNumber("hello 42", "string")).toBe("hello 42")
  })

  it("strips foreign characters and keeps a single decimal separator", () => {
    expect(formatAutoscaleNumber("$1a2,3.4x5.6", "us")).toBe("123.456")
  })

  it("preserves a trailing decimal separator so typing can continue", () => {
    expect(formatAutoscaleNumber("1234.", "us")).toBe("1,234.")
  })

  it("returns an empty string for empty input", () => {
    expect(formatAutoscaleNumber("", "us")).toBe("")
  })
})
