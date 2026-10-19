import { describe, expect, it } from "vitest"
import { MAX_RECONNECT_DELAY_MS, reconnectDelayMs } from "../backoff"

describe("reconnectDelayMs", () => {
  it("grows exponentially from one second", () => {
    expect(reconnectDelayMs(0, 0)).toBe(1000)
    expect(reconnectDelayMs(1, 0)).toBe(2000)
    expect(reconnectDelayMs(2, 0)).toBe(4000)
    expect(reconnectDelayMs(3, 0)).toBe(8000)
  })

  it("caps the exponential part so a long outage never parks the tab", () => {
    expect(reconnectDelayMs(10, 0)).toBe(MAX_RECONNECT_DELAY_MS)
    expect(reconnectDelayMs(50, 0)).toBe(MAX_RECONNECT_DELAY_MS)
  })

  it("adds jitter on top so many tabs don't retry in lockstep", () => {
    expect(reconnectDelayMs(0, 1)).toBe(1250)
    expect(reconnectDelayMs(10, 1)).toBe(MAX_RECONNECT_DELAY_MS + 250)
  })

  it("treats a negative attempt as the first one", () => {
    expect(reconnectDelayMs(-1, 0)).toBe(1000)
  })
})
