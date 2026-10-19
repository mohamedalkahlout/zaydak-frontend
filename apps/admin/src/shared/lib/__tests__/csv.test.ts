import { describe, expect, it } from "vitest"

import { toCsv, type CsvRow } from "../csv"

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("")
  })

  it("takes the header from the first row's keys, in order", () => {
    expect(toCsv([{ b: "2", a: "1" }])).toBe("b,a\r\n2,1")
  })

  it("separates rows with CRLF, per RFC-4180", () => {
    expect(toCsv([{ a: "1" }, { a: "2" }])).toBe("a\r\n1\r\n2")
  })

  it("quotes a field containing a comma", () => {
    // The reason this matters here: an identifier or a gateway error message
    // with a comma in it would otherwise shift every column after it.
    expect(toCsv([{ a: "x,y" }])).toBe('a\r\n"x,y"')
  })

  it("doubles an embedded quote and wraps the field", () => {
    expect(toCsv([{ a: 'he said "hi"' }])).toBe('a\r\n"he said ""hi"""')
  })

  it("quotes a field containing a newline", () => {
    expect(toCsv([{ a: "line1\nline2" }])).toBe('a\r\n"line1\nline2"')
  })

  it("leaves an ordinary field unquoted", () => {
    expect(toCsv([{ a: "plain" }])).toBe("a\r\nplain")
  })

  it("writes numbers without quoting them", () => {
    expect(toCsv([{ a: 42 }])).toBe("a\r\n42")
  })

  it("fills a key missing from a later row rather than shifting columns", () => {
    const rows = [{ a: "1", b: "2" }, { a: "3" }] as CsvRow[]
    expect(toCsv(rows)).toBe("a,b\r\n1,2\r\n3,")
  })
})
