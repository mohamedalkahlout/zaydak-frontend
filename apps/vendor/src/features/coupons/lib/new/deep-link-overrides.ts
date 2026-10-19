/**
 * Coupon-form deep-link overrides — read once when a form mounts to seed
 * its `defaultValues`. Today the only supported deep-link is
 * `?segment=<segmentId>` (used by the "Create discount" item in the
 * segments editor's Use-segment menu) but the helper is shaped so other
 * pre-fills can layer in here without touching every form file.
 *
 * Returning `undefined` for a field means "use the form's own default" so
 * forms can spread the result safely:
 *
 *   const overrides = useDeepLinkOverrides()
 *   useForm({ defaultValues: { ...baseCouponDefaults(), ...overrides, ... } })
 */

"use client"

import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useTranslations } from "next-intl"

export interface CouponDeepLinkOverrides {
  eligibility?: "segment"
  segment_ids?: string[]
}

export function useCouponDeepLinkOverrides(): CouponDeepLinkOverrides {
  const params = useSearchParams()
  return useMemo<CouponDeepLinkOverrides>(() => {
    const segmentId = params?.get("segment")
    if (segmentId) {
      return {
        eligibility: "segment",
        segment_ids: [segmentId],
      }
    }
    return {}
  }, [params])
}

/**
 * The segment label snapshot lives in the form-level overlay so the
 * picker chips render *something* before the picker is opened. Without a
 * label we'd display the raw UUID. Returned as a partial snapshot map so
 * it composes with the `?segment=X` override.
 */
export function useCouponDeepLinkSegmentLabels(): Record<
  string,
  { name: string }
> {
  const params = useSearchParams()
  const t = useTranslations("coupons.eligibility")
  return useMemo(() => {
    const segmentId = params?.get("segment")
    if (!segmentId) return {}
    // We don't know the name yet — the picker will replace it on first
    // confirm. Showing "Selected segment" is friendlier than a UUID.
    return { [segmentId]: { name: t("selectedSegment") } }
  }, [params, t])
}
