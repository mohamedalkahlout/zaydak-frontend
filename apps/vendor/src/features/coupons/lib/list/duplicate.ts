import type { Coupon } from "@/features/coupons/types"

import { normalizeCouponType } from "./helpers"

const CODE_MAX = 50
const COPY_SUFFIX = "-COPY"

/** A code the create form can save without colliding with the source coupon. */
export function duplicateCouponCode(code: string | null | undefined): string {
  const base = (code ?? "").trim()
  if (!base) return ""
  const room = CODE_MAX - COPY_SUFFIX.length
  return `${base.slice(0, Math.max(room, 0))}${COPY_SUFFIX}`
}

/** Opens the matching create form, seeded from this coupon. */
export function duplicateCouponHref(
  shopSlug: string,
  coupon: Pick<Coupon, "id" | "type">,
): string {
  const type = normalizeCouponType(coupon.type)
  const from = encodeURIComponent(coupon.id)
  return `/store/${shopSlug}/coupons/new/${type}?from=${from}`
}
