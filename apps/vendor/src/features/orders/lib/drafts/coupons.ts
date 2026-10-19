import type { DraftOrder } from "@/features/orders/types"
import { hasValidationCode } from "@/shared/lib/validation-errors"

/** The most coupons one draft may carry (the server's `MAX_DRAFT_COUPONS`). */
export const MAX_DRAFT_COUPONS = 5

/**
 * A coupon staged on the draft form. Only `id` is saved (`coupon_ids`); the
 * rest is for display. The draft never prices a coupon: `createOrder` does,
 * when the draft converts, against the draft's customer.
 */
export interface DraftCouponPick {
  id: string
  code: string | null
  description: string | null
  /** False when the coupon was deleted after it was added. */
  available: boolean
  /** Targets customers or caps uses per customer: needs a customer. */
  requiresCustomer: boolean
  /**
   * VERIFY_COUPON's `discount_preview.total_cents`, or null when there is
   * none. An ESTIMATE only: verify evaluates for the signed-in merchant and
   * the lines as staged, while conversion prices for the draft's customer
   * with stacking, shipping and tax applied. Never saved.
   */
  estimateCents: number | null
  /** True when a preview ran and could not price the coupon. */
  previewFailed: boolean
}

/** The stored coupons of a loaded draft, as the form stages them. */
export function draftCouponsFromDraft(draft?: DraftOrder): DraftCouponPick[] {
  const resolved = new Map((draft?.coupons ?? []).map((c) => [c.id, c]))
  return (draft?.coupon_ids ?? []).map((id) => {
    const c = resolved.get(id)
    return {
      id,
      code: c?.code ?? null,
      description: c?.description ?? null,
      available: c?.available ?? false,
      requiresCustomer: c?.requires_customer ?? false,
      estimateCents: null,
      previewFailed: false,
    }
  })
}

/**
 * The server's `couponRequiresCustomer`, for a row from the coupon list that
 * has not been saved yet (a saved one carries `requires_customer`). Only used
 * to warn early; the server decides.
 */
export function couponRowRequiresCustomer(row: {
  eligibility?: string | null
  max_uses_per_user?: number | null
}): boolean {
  const eligibility = (row.eligibility ?? "ALL_CUSTOMERS").toUpperCase()
  return eligibility !== "ALL_CUSTOMERS" || (row.max_uses_per_user ?? 0) > 0
}

/** What the form shows for a coupon: its code, else its description. */
export function draftCouponLabel(
  pick: Pick<DraftCouponPick, "code" | "description">,
  automaticLabel: string,
): string {
  return pick.code || pick.description || automaticLabel
}

/**
 * The known estimates, summed. `complete` is false when at least one coupon
 * has no figure, so the form can say "priced at conversion" instead of
 * implying the sum covers everything.
 */
export function sumCouponEstimates(picks: readonly DraftCouponPick[]): {
  cents: number
  complete: boolean
} {
  let cents = 0
  let complete = true
  for (const p of picks) {
    if (p.estimateCents === null) complete = false
    else cents += p.estimateCents
  }
  return { cents, complete }
}

/**
 * The message key for a coupon refusal from saving or converting, or null
 * when the error is about something else. The server's own sentence is
 * English and names the coupon by id; these say what to do.
 */
export function draftCouponErrorKey(
  err: unknown,
):
  | "couponErrorNeedsCustomer"
  | "couponErrorInvalid"
  | "couponErrorNotApplicable"
  | "couponErrorUsedUp"
  | null {
  if (hasValidationCode(err, "coupon_requires_customer"))
    return "couponErrorNeedsCustomer"
  if (hasValidationCode(err, "invalid_coupon")) return "couponErrorInvalid"
  if (
    hasValidationCode(err, "coupon_not_applicable") ||
    hasValidationCode(err, "conflict")
  )
    return "couponErrorNotApplicable"
  if (
    hasValidationCode(err, "user_limit") ||
    hasValidationCode(err, "global_limit")
  )
    return "couponErrorUsedUp"
  return null
}
