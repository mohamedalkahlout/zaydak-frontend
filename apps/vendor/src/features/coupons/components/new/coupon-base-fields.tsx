"use client"

import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import type { InitialCouponSnapshots } from "@/features/coupons/lib/new/from-coupon-entry"
import { ActiveDatesCard } from "./cards/active-dates-card"
import { CombinationsCard } from "./cards/combinations-card"
import { EligibilityCard } from "./cards/eligibility-card"
import { MaximumUsesCard } from "./cards/maximum-uses-card"
import { MinimumPurchaseCard } from "./cards/minimum-purchase-card"

interface BaseFieldsProps {
  form: CouponFormApi
  /** Hide sections that don't apply to a given type (e.g. BOGO has no min purchase). */
  hide?: {
    minimumPurchase?: boolean
    combinations?: boolean
  }
  /** Id → name map for customers/segments pre-loaded from `coupon(id)`. */
  snapshots?: InitialCouponSnapshots
}

/**
 * Composes the cards every coupon form shares: eligibility, minimum
 * purchase, max uses, combinations, active dates. The owning form passes
 * its `useForm` instance in once.
 */
export function CouponBaseFields({ form, hide, snapshots }: BaseFieldsProps) {
  return (
    <>
      <EligibilityCard form={form} snapshots={snapshots} />
      {!hide?.minimumPurchase && <MinimumPurchaseCard form={form} />}
      <MaximumUsesCard form={form} />
      {!hide?.combinations && <CombinationsCard form={form} />}
      <ActiveDatesCard form={form} />
    </>
  )
}

export { CouponHeaderCard } from "./cards/coupon-header-card"
export { RadioRow } from "./ui/radio-row"
