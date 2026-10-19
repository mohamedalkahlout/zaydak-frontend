import { describe, expect, it } from "vitest"
import { scrubSentryEvent } from "../scrub"

describe("scrubSentryEvent", () => {
  it("redacts Authorization and leaves user id only", () => {
    const event = {
      request: {
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
      },
      user: { id: "u1", email: "a@b.c" },
    }
    scrubSentryEvent(event)
    expect(event.request.headers.authorization).toBe("[Filtered]")
    expect(event.request.headers["content-type"]).toBe("application/json")
    expect(event.user).toEqual({ id: "u1" })
  })

  it("redacts JWT-shaped strings in breadcrumbs", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature"
    const event = {
      breadcrumbs: {
        values: [{ message: `token ${jwt}`, data: { otp: "123456" } }],
      },
    }
    scrubSentryEvent(event)
    expect(event.breadcrumbs.values[0].message).not.toContain("eyJ")
    expect(event.breadcrumbs.values[0].data?.otp).toBe("[Filtered]")
  })
})
