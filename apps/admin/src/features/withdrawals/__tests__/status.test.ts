import { describe, expect, it } from "vitest"

import { WithdrawalStatus } from "@/shared/api/generated/graphql"
import {
  WITHDRAWAL_STATUSES,
  availableTransitions,
  canDelete,
  moneyEffect,
  statusBadgeVariant,
} from "../status"

const { Pending, OnHold, Approved, Rejected } = WithdrawalStatus

describe("WITHDRAWAL_STATUSES", () => {
  it("covers every value of the back-end enum", () => {
    expect([...WITHDRAWAL_STATUSES].sort()).toEqual(
      Object.values(WithdrawalStatus).sort(),
    )
  })
})

describe("statusBadgeVariant", () => {
  it("maps each status to a distinct variant", () => {
    const variants = WITHDRAWAL_STATUSES.map(statusBadgeVariant)
    expect(new Set(variants).size).toBe(WITHDRAWAL_STATUSES.length)
  })

  it("flags rejection as destructive and approval as default", () => {
    expect(statusBadgeVariant(Rejected)).toBe("destructive")
    expect(statusBadgeVariant(Approved)).toBe("default")
  })
})

describe("availableTransitions", () => {
  it("offers every status except the current one", () => {
    expect(availableTransitions(Pending)).toEqual([OnHold, Approved, Rejected])
    expect(availableTransitions(Approved)).toEqual([Pending, OnHold, Rejected])
  })

  it("never offers a self-transition", () => {
    for (const status of WITHDRAWAL_STATUSES) {
      expect(availableTransitions(status)).not.toContain(status)
    }
  })
})

describe("moneyEffect", () => {
  it("debits the shop balance when a request becomes approved", () => {
    expect(moneyEffect(Pending, Approved)).toBe("debit")
    expect(moneyEffect(OnHold, Approved)).toBe("debit")
    expect(moneyEffect(Rejected, Approved)).toBe("debit")
  })

  it("reverses the payout when a request leaves approved", () => {
    expect(moneyEffect(Approved, Rejected)).toBe("reversal")
    expect(moneyEffect(Approved, Pending)).toBe("reversal")
    expect(moneyEffect(Approved, OnHold)).toBe("reversal")
  })

  it("moves no money between non-approved statuses", () => {
    expect(moneyEffect(Pending, OnHold)).toBe("none")
    expect(moneyEffect(OnHold, Rejected)).toBe("none")
    expect(moneyEffect(Rejected, Pending)).toBe("none")
  })

  it("treats approved → approved as a no-op, not a double debit", () => {
    expect(moneyEffect(Approved, Approved)).toBe("none")
  })
})

describe("canDelete", () => {
  it("blocks deleting an approved withdrawal — the back-end would strand the funds", () => {
    expect(canDelete(Approved)).toBe(false)
  })

  it("allows deleting any request that never moved money", () => {
    expect(canDelete(Pending)).toBe(true)
    expect(canDelete(OnHold)).toBe(true)
    expect(canDelete(Rejected)).toBe(true)
  })
})
