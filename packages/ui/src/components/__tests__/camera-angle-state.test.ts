import { describe, expect, it } from "vitest"
import {
  glReducer,
  MAX_AUTO_RETRIES,
  type GlState,
  type GlAction,
} from "../camera-angle-state"

const initial: GlState = {
  status: "starting",
  failure: null,
  canvasKey: 0,
}

describe("glReducer", () => {
  it("START increments canvasKey and sets starting", () => {
    const s = glReducer(initial, { type: "START" })
    expect(s.status).toBe("starting")
    expect(s.failure).toBeNull()
    expect(s.canvasKey).toBe(1)
  })

  it("LIVE sets status to live", () => {
    const s = glReducer(initial, { type: "LIVE" })
    expect(s.status).toBe("live")
  })

  it("LOST sets status to lost", () => {
    const s = glReducer({ ...initial, status: "live" }, { type: "LOST" })
    expect(s.status).toBe("lost")
  })

  it("RESTORE_TIMEOUT retries when under limit", () => {
    const s = glReducer(
      { ...initial, status: "lost" },
      { type: "RESTORE_TIMEOUT", autoRetries: 0 },
    )
    expect(s.status).toBe("starting")
    expect(s.canvasKey).toBe(1)
  })

  it("RESTORE_TIMEOUT fails when at retry limit", () => {
    const s = glReducer(
      { ...initial, status: "lost" },
      { type: "RESTORE_TIMEOUT", autoRetries: MAX_AUTO_RETRIES },
    )
    expect(s.status).toBe("failed")
    expect(s.failure).toBe("lost")
  })

  it("FAIL sets failed with the given reason", () => {
    const s = glReducer(initial, { type: "FAIL", reason: "creation-error" })
    expect(s.status).toBe("failed")
    expect(s.failure).toBe("creation-error")
  })

  it("RESET clears failure and increments canvasKey", () => {
    const s = glReducer(
      { status: "failed", failure: "crash", canvasKey: 5 },
      { type: "RESET" },
    )
    expect(s.status).toBe("starting")
    expect(s.failure).toBeNull()
    expect(s.canvasKey).toBe(6)
  })

  it("unknown action returns state unchanged", () => {
    const s = glReducer(initial, { type: "UNKNOWN" } as unknown as GlAction)
    expect(s).toBe(initial)
  })
})
