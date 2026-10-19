import { describe, expect, it } from "vitest"
import {
  overallState,
  setupState,
  setupTone,
  type DomainChecks,
} from "../domain-status"

// The one place a domain's state is derived for the screen. Two sources feed
// it — the stored row for the list, the live checks for the detail page — and
// the cases worth pinning are the ones where they say different things.

const checks = (over: Partial<DomainChecks> = {}): DomainChecks => ({
  dns_configured: false,
  dns_propagated: false,
  ownership_verified: false,
  routing_ready: false,
  tls: "PENDING",
  ...over,
})

const done = (): DomainChecks =>
  checks({
    dns_configured: true,
    dns_propagated: true,
    ownership_verified: true,
    routing_ready: true,
    tls: "READY",
  })

describe("setupState from the stored row", () => {
  it("reads the coarse statuses directly", () => {
    expect(setupState({ status: "ACTIVE" })).toBe("CONNECTED")
    expect(setupState({ status: "PENDING" })).toBe("NEEDS_SETUP")
    expect(setupState({ status: "FAILED" })).toBe("ERROR")
  })

  it("splits VERIFYING by whether the provider is still waiting on records", () => {
    // The provider writes back the records it is still waiting on, so a
    // VERIFYING row with records outstanding is wrong DNS, and one with none
    // is right DNS waiting on the platform.
    expect(
      setupState({ status: "VERIFYING", dns_records: [{ type: "A" }] }),
    ).toBe("INVALID_DNS")
    expect(setupState({ status: "VERIFYING", dns_records: [] })).toBe(
      "PROVISIONING",
    )
    expect(setupState({ status: "VERIFYING" })).toBe("PROVISIONING")
  })
})

describe("setupState from live checks", () => {
  it("is connected only when every check has passed", () => {
    expect(setupState({ status: "VERIFYING" }, done())).toBe("CONNECTED")
  })

  it("calls wrong DNS 'needs setup' before the first Verify and 'invalid' after it", () => {
    expect(setupState({ status: "PENDING" }, checks())).toBe("NEEDS_SETUP")
    expect(setupState({ status: "VERIFYING" }, checks())).toBe("INVALID_DNS")
  })

  it("lets live evidence outrank a stored ACTIVE", () => {
    // Records deleted after the domain went live: the truth the nightly
    // sweep will catch up with, shown now rather than a green pill over it.
    expect(setupState({ status: "ACTIVE" }, checks())).toBe("INVALID_DNS")
  })

  it("is provisioning once the records are right and anything else is pending", () => {
    expect(
      setupState({ status: "VERIFYING" }, checks({ dns_configured: true })),
    ).toBe("PROVISIONING")
    expect(
      setupState(
        { status: "VERIFYING" },
        checks({
          dns_configured: true,
          dns_propagated: true,
          ownership_verified: true,
          routing_ready: true,
          tls: "PROVISIONING",
        }),
      ),
    ).toBe("PROVISIONING")
  })

  it("is an error when the certificate cannot be issued, whatever else says", () => {
    expect(
      setupState({ status: "ACTIVE" }, checks({ ...done(), tls: "FAILED" })),
    ).toBe("ERROR")
  })
})

describe("setupTone", () => {
  it("colours the five states as done, waiting, in progress, or wrong", () => {
    expect(setupTone("CONNECTED")).toBe("ok")
    expect(setupTone("NEEDS_SETUP")).toBe("waiting")
    expect(setupTone("PROVISIONING")).toBe("progress")
    expect(setupTone("INVALID_DNS")).toBe("error")
    expect(setupTone("ERROR")).toBe("error")
  })
})

describe("overallState", () => {
  it("stays verifying while the certificate is still issuing", () => {
    // DNS being right is not the domain being served. Reporting "connected"
    // here hands the merchant a green badge over a TLS error.
    expect(overallState(checks({ ...done(), tls: "PROVISIONING" }))).toBe(
      "verifying",
    )
  })

  it("reports failure when the certificate failed", () => {
    expect(overallState(checks({ tls: "FAILED" }))).toBe("failed")
  })
})
