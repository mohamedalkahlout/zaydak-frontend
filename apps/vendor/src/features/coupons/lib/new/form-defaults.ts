import {
  detectTimezone,
  nowLocalTime,
  todayLocalISODate,
} from "@/features/coupons/validations/coupon"

/**
 * Defaults shared by every coupon form. Each per-type form spreads these
 * and then layers its own type-specific defaults on top, so the four form
 * files no longer have to keep four copies of the same UI flags in sync.
 */
export function baseCouponDefaults() {
  return {
    method: "code" as const,
    eligibility: "all_customers" as const,
    minimum_mode: "none" as const,
    limit_uses: false,
    limit_one_per_customer: false,
    is_exclusive: false,
    allow_product: false,
    allow_order: false,
    allow_shipping: false,
    set_end_date: false,
    active_from_date: todayLocalISODate(),
    active_from_time: nowLocalTime(),
    timezone: detectTimezone(),
  }
}
