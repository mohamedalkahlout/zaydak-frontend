import { describe, expect, it } from "vitest"
import { tunnelHeaders } from "../tunnel-headers"

describe("tunnelHeaders", () => {
  it("is empty for localhost", () => {
    expect(tunnelHeaders("http://localhost:3000/graphql")).toEqual({})
  })

  it("is empty for a production API host", () => {
    expect(tunnelHeaders("https://api.zaydak.com/graphql")).toEqual({})
  })

  it("is empty for a relative URL", () => {
    expect(tunnelHeaders("/graphql")).toEqual({})
  })

  it.each([
    "https://abc123.ngrok-free.app/graphql",
    "https://abc123.ngrok.app/graphql",
    "https://abc123.ngrok.io/graphql",
    "https://abc123.ngrok-free.dev/graphql",
  ])("skips the interstitial on %s", (url) => {
    expect(tunnelHeaders(url)).toEqual({
      "ngrok-skip-browser-warning": "1",
    })
  })
})
