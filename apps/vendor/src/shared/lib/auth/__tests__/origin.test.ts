import { describe, expect, it } from "vitest"

import { isSameOrigin } from "../origin"

function request(
  headers: Record<string, string>,
  url = "http://localhost:3001/api/auth/session",
) {
  return new Request(url, { method: "POST", headers })
}

describe("isSameOrigin (vendor)", () => {
  it("trusts Sec-Fetch-Site: same-origin", () => {
    expect(
      isSameOrigin(request({ "sec-fetch-site": "same-origin" })),
    ).toBe(true)
  })

  it("rejects a cross-site fetch even when Origin matches", () => {
    expect(
      isSameOrigin(
        request({
          "sec-fetch-site": "cross-site",
          origin: "http://localhost:3001",
        }),
      ),
    ).toBe(false)
  })

  it("falls back to matching Origin against the request host", () => {
    expect(
      isSameOrigin(request({ origin: "http://localhost:3001" })),
    ).toBe(true)
    expect(
      isSameOrigin(request({ origin: "https://evil.example" })),
    ).toBe(false)
  })

  it("allows a request with neither header (not a browser form post)", () => {
    expect(isSameOrigin(request({}))).toBe(true)
  })
})
