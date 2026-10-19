import { afterEach, describe, expect, it, vi } from "vitest"

import {
  SIGNUP_PROGRESS_KEY,
  clearSignupProgress,
  readSignupProgress,
  shouldRestoreSignupProgress,
  writeSignupProgress,
} from "../progress"

describe("signup progress storage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("round-trips a value and clearSignupProgress drops it", () => {
    writeSignupProgress({ pane: "personal", email: "a@b.com" })
    expect(readSignupProgress<{ pane: string }>()).toEqual({
      pane: "personal",
      email: "a@b.com",
    })
    expect(sessionStorage.getItem(SIGNUP_PROGRESS_KEY)).toBeTruthy()

    clearSignupProgress()
    expect(readSignupProgress()).toBeNull()
    expect(sessionStorage.getItem(SIGNUP_PROGRESS_KEY)).toBeNull()
  })

  it("restores only after a reload of /register", () => {
    expect(shouldRestoreSignupProgress()).toBe(true)

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "reload" },
    ] as unknown as PerformanceEntryList)
    expect(shouldRestoreSignupProgress()).toBe(true)

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "navigate" },
    ] as unknown as PerformanceEntryList)
    expect(shouldRestoreSignupProgress()).toBe(false)
  })
})
