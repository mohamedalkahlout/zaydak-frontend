import type { ReturnStatus, ReturnStatusInput } from "@/features/returns/types"

/**
 * The RMA state machine, mirroring `VALID_RETURN_TRANSITIONS` on the back-end.
 * Offering a transition the server would reject with `invalid_transition` is a
 * dead button, so this table has to stay in step with it.
 */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["in_transit", "rejected"],
  in_transit: ["received"],
  received: ["closed"],
  closed: [],
  rejected: [],
}

export function nextReturnStatuses(status: ReturnStatus): ReturnStatus[] {
  return RETURN_TRANSITIONS[status] ?? []
}

export function isTerminalReturnStatus(status: ReturnStatus): boolean {
  return nextReturnStatuses(status).length === 0
}

/**
 * The API reads a return's status back as lowercase (`in_transit`) but only
 * accepts the GraphQL enum, which is uppercase (`IN_TRANSIT`). Feeding a status
 * straight from a row back into the mutation therefore fails. Every write goes
 * through here.
 */
export function toReturnStatusInput(status: ReturnStatus): ReturnStatusInput {
  return status.toUpperCase() as ReturnStatusInput
}

/**
 * `received` is the only transition that moves money: the back-end issues the
 * refund there (net of the shop's restocking fee) and restocks the lines flagged
 * for it. Everything else just advances the paperwork.
 */
export function movesMoney(target: ReturnStatus): boolean {
  return target === "received"
}

/*
 * No words live here. A status reads as `returns.views.<status>` and the button
 * for a transition as `returns.actions.<target>`, both in
 * `messages/{en,ar}/returns.json`.
 */

export const RETURN_STATUS_VARIANT: Record<
  ReturnStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  requested: "secondary",
  approved: "default",
  in_transit: "secondary",
  received: "default",
  closed: "outline",
  rejected: "destructive",
}
