import { describe, expect, it } from "vitest"

import { OtpLogStatus } from "@/shared/api/generated/graphql"
import { isRevealable, verifierLabel } from "../types"

describe("isRevealable", () => {
  it("offers a live code of our own", () => {
    expect(isRevealable({ status: OtpLogStatus.Pending, verifier: null })).toBe(true)
  })

  it("never offers a code the SMS provider issued", () => {
    // Twilio Verify generated it and checks it; the row holds no hash, so the
    // server would refuse the reveal anyway.
    expect(isRevealable({ status: OtpLogStatus.Pending, verifier: "twilio" })).toBe(false)
  })

  it("never offers a code that is no longer live", () => {
    expect(isRevealable({ status: OtpLogStatus.Verified, verifier: null })).toBe(false)
  })
})

describe("verifierLabel", () => {
  it("names Twilio Verify and Msegat OTP, passes other providers through, and is null for ours", () => {
    expect(verifierLabel("twilio")).toBe("Twilio Verify")
    expect(verifierLabel("msegat")).toBe("Msegat OTP")
    expect(verifierLabel("taqnyat")).toBe("taqnyat")
    expect(verifierLabel(null)).toBeNull()
  })
})
