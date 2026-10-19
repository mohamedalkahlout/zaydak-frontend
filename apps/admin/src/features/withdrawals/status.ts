import { WithdrawalStatus } from "@/shared/api/generated/graphql"

/**
 * Every status the back-end enum defines, in workflow order.
 *
 * Codegen emits `WithdrawalStatus` as a TypeScript enum whose member names are
 * camel-cased (`OnHold`) and whose values are the wire strings (`ON_HOLD`). The
 * wire value is what i18n keys and the GraphQL variable both use.
 */
export const WITHDRAWAL_STATUSES = [
  WithdrawalStatus.Pending,
  WithdrawalStatus.OnHold,
  WithdrawalStatus.Approved,
  WithdrawalStatus.Rejected,
] as const

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

export function statusBadgeVariant(status: WithdrawalStatus): BadgeVariant {
  switch (status) {
    case WithdrawalStatus.Approved:
      return "default"
    case WithdrawalStatus.Rejected:
      return "destructive"
    case WithdrawalStatus.OnHold:
      return "outline"
    case WithdrawalStatus.Pending:
      return "secondary"
  }
}

/**
 * Statuses an admin may move a request to. The back-end enforces no state
 * machine — `WithdrawalsService.updateStatus` accepts any transition — so the
 * only rule here is "not the status it already has".
 */
export function availableTransitions(
  current: WithdrawalStatus,
): WithdrawalStatus[] {
  return WITHDRAWAL_STATUSES.filter((s) => s !== current)
}

/**
 * Whether a transition moves money, and in which direction.
 *
 * `updateStatus` debits `current_balance` into `withdrawn_amount` and writes a
 * `payout` ledger row when a request becomes APPROVED, and reverses both when it
 * leaves APPROVED. Every other transition is a pure status flip. The console
 * spells this out in the confirmation dialog rather than letting an admin move
 * money with an unlabelled menu click.
 */
export type MoneyEffect = "debit" | "reversal" | "none"

export function moneyEffect(
  from: WithdrawalStatus,
  to: WithdrawalStatus,
): MoneyEffect {
  if (to === WithdrawalStatus.Approved && from !== WithdrawalStatus.Approved) {
    return "debit"
  }
  if (from === WithdrawalStatus.Approved && to !== WithdrawalStatus.Approved) {
    return "reversal"
  }
  return "none"
}

/**
 * `WithdrawalsService.delete` only stamps `deleted_at` — it never reverses an
 * approved payout, so soft-deleting an APPROVED request strands the amount
 * (debited from `current_balance`, parked in `withdrawn_amount`, with no
 * reversal ledger row). Block it in the console until the back-end unwinds the
 * balance on delete. This is a UX guard, not a security boundary: the mutation
 * still accepts the call.
 */
export function canDelete(status: WithdrawalStatus): boolean {
  return status !== WithdrawalStatus.Approved
}
