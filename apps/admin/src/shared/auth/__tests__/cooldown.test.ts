import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getRemainingCooldownSeconds, startCooldown } from "../cooldown"

describe("cooldown", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-10T00:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 0 for a key that was never started", () => {
    expect(getRemainingCooldownSeconds("resend-otp")).toBe(0)
  })

  it("counts down from the requested duration", () => {
    startCooldown("resend-otp", 60)
    expect(getRemainingCooldownSeconds("resend-otp")).toBe(60)

    vi.advanceTimersByTime(25_000)
    expect(getRemainingCooldownSeconds("resend-otp")).toBe(35)
  })

  it("keys are independent", () => {
    startCooldown("resend-otp", 60)
    expect(getRemainingCooldownSeconds("forgot-password")).toBe(0)
  })

  it("expires and clears its storage entry once elapsed", () => {
    startCooldown("resend-otp", 30)
    vi.advanceTimersByTime(30_000)

    expect(getRemainingCooldownSeconds("resend-otp")).toBe(0)
    expect(window.localStorage.getItem("cooldown_until:resend-otp")).toBeNull()
  })

  it("never reports a negative remainder", () => {
    startCooldown("resend-otp", 5)
    vi.advanceTimersByTime(60_000)
    expect(getRemainingCooldownSeconds("resend-otp")).toBe(0)
  })
})
