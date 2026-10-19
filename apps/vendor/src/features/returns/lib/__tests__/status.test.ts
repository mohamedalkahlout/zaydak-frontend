import { describe, expect, it } from "vitest"
import {
  isTerminalReturnStatus,
  movesMoney,
  nextReturnStatuses,
  RETURN_TRANSITIONS,
  toReturnStatusInput,
} from "../status"
import type { ReturnStatus } from "@/features/returns/types"

describe("RETURN_TRANSITIONS", () => {
  it("matches the back-end state machine exactly", () => {
    // Copied from VALID_RETURN_TRANSITIONS in back-end/src/returns/types/
    // return.types.ts. Offering a transition the server rejects with
    // `invalid_transition` is a dead button, so drift here is a real bug.
    expect(RETURN_TRANSITIONS).toEqual({
      requested: ["approved", "rejected"],
      approved: ["in_transit", "rejected"],
      in_transit: ["received"],
      received: ["closed"],
      closed: [],
      rejected: [],
    })
  })

  it("cannot jump straight from requested to received", () => {
    // The money step is only reachable after the goods are actually in transit.
    expect(nextReturnStatuses("requested")).not.toContain("received")
  })

  it("treats closed and rejected as terminal", () => {
    expect(isTerminalReturnStatus("closed")).toBe(true)
    expect(isTerminalReturnStatus("rejected")).toBe(true)
  })

  it("keeps every non-terminal status actionable", () => {
    for (const status of ["requested", "approved", "in_transit", "received"] as ReturnStatus[]) {
      expect(nextReturnStatuses(status).length).toBeGreaterThan(0)
    }
  })
})

describe("toReturnStatusInput", () => {
  it("uppercases a status for the input enum", () => {
    // The API reads `in_transit` back but only accepts `IN_TRANSIT`. Feeding a
    // status straight from a row into the mutation is the trap this closes.
    expect(toReturnStatusInput("in_transit")).toBe("IN_TRANSIT")
    expect(toReturnStatusInput("requested")).toBe("REQUESTED")
  })

  it("round-trips every status the state machine can produce", () => {
    const all = Object.keys(RETURN_TRANSITIONS) as ReturnStatus[]
    for (const status of all) {
      expect(toReturnStatusInput(status)).toBe(status.toUpperCase())
    }
  })
})

describe("movesMoney", () => {
  it("is true only for received — the transition that issues the refund", () => {
    expect(movesMoney("received")).toBe(true)
    for (const status of [
      "requested",
      "approved",
      "in_transit",
      "closed",
      "rejected",
    ] as ReturnStatus[]) {
      expect(movesMoney(status)).toBe(false)
    }
  })
})
