import { describe, expect, it } from "vitest"

import { resetCodeLength, resetPasswordHref } from "../send-code"

describe("resetPasswordHref", () => {
  it("carries the identifier and the length the send announced", () => {
    const href = resetPasswordHref("a+b@example.com", 4)
    const params = new URL(href, "http://x").searchParams

    expect(href.startsWith("/reset-password?")).toBe(true)
    expect(params.get("identifier")).toBe("a+b@example.com")
    expect(params.get("code_length")).toBe("4")
  })

  it("keeps a phone number's plus sign", () => {
    const params = new URL(resetPasswordHref("+970599123456", 6), "http://x")
      .searchParams

    expect(params.get("identifier")).toBe("+970599123456")
  })

  it("writes six for a length outside 4 to 8", () => {
    const params = new URL(resetPasswordHref("a@b.com", 12), "http://x")
      .searchParams

    expect(params.get("code_length")).toBe("6")
  })
})

describe("resetCodeLength", () => {
  const read = (search: string) => resetCodeLength(new URLSearchParams(search))

  it("reads a length in range", () => {
    expect(read("code_length=4")).toBe(4)
    expect(read("code_length=8")).toBe(8)
  })

  it.each(["", "code_length=", "code_length=3", "code_length=9", "code_length=4.5", "code_length=six"])(
    "is six for %j",
    (search) => {
      expect(read(search)).toBe(6)
    },
  )

  it("round-trips what resetPasswordHref wrote", () => {
    const href = resetPasswordHref("a@b.com", 7)
    expect(resetCodeLength(new URL(href, "http://x").searchParams)).toBe(7)
  })
})
