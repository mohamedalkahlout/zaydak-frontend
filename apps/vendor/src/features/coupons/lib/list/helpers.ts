import {
  GlobeIcon,
  LayersIcon,
  PackageIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format"
import type { Translate } from "@/shared/i18n/translator"
import type { Coupon, CouponType } from "@/features/coupons/types"
import { formatList } from "../format-list"
import type { CouponScope, CouponStatus } from "./constants"

export type CouponScopePart = {
  key: "products" | "collections" | "customers" | "segments" | "countries"
  icon: LucideIcon
  count: number
  label: string
}

/**
 * Normalize the `type` field regardless of casing the server sends
 * (docs show lowercase like "fixed", but a few endpoints use UPPERCASE).
 */
export function normalizeCouponType(type: string): CouponType {
  return type.toLowerCase() as CouponType
}

export function couponStatus(coupon: Coupon, now: Date = new Date()): CouponStatus {
  const active = new Date(coupon.active_from)
  if (now < active) return "scheduled"
  if (coupon.expire_at) {
    const expire = new Date(coupon.expire_at)
    if (now > expire) return "expired"
  }
  return "active"
}

/**
 * A coupon is "scoped" when it restricts who or what it applies to via any
 * of the list-based fields. This covers all restriction axes — products,
 * collections, customers, segments, or countries (for FREE_SHIPPING).
 * Used by the faceted filter on the list page.
 */
export function couponScope(coupon: Coupon): CouponScope {
  return hasAnyScope(coupon) ? "scoped" : "general"
}

function hasAnyScope(coupon: Coupon): boolean {
  return (
    (coupon.product_ids?.length ?? 0) > 0 ||
    (coupon.collection_ids?.length ?? 0) > 0 ||
    (coupon.customer_ids?.length ?? 0) > 0 ||
    (coupon.segment_ids?.length ?? 0) > 0 ||
    (coupon.countries?.length ?? 0) > 0
  )
}

/**
 * Returns restrictions as structured parts so the list cell can render
 * them as icon chips. Empty array → no restrictions (cell falls back
 * to `couponScopeFallback`).
 *
 * `t` is the `coupons` translator: each label is a plural message under
 * `coupons.counts`, so "1 product" and "3 منتجات" come out of the catalogue
 * rather than an English `s` appended here.
 */
export function couponScopeParts(coupon: Coupon, t: Translate): CouponScopePart[] {
  const parts: CouponScopePart[] = []
  const products = coupon.product_ids?.length ?? 0
  const collections = coupon.collection_ids?.length ?? 0
  const customers = coupon.customer_ids?.length ?? 0
  const segments = coupon.segment_ids?.length ?? 0
  const countries = coupon.countries?.length ?? 0

  if (products > 0) {
    parts.push({
      key: "products",
      icon: PackageIcon,
      count: products,
      label: t("counts.products", { count: products }),
    })
  }
  if (collections > 0) {
    parts.push({
      key: "collections",
      icon: LayersIcon,
      count: collections,
      label: t("counts.collections", { count: collections }),
    })
  }
  if (customers > 0) {
    parts.push({
      key: "customers",
      icon: UserIcon,
      count: customers,
      label: t("counts.customers", { count: customers }),
    })
  }
  if (segments > 0) {
    parts.push({
      key: "segments",
      icon: UsersIcon,
      count: segments,
      label: t("counts.segments", { count: segments }),
    })
  }
  if (countries > 0) {
    parts.push({
      key: "countries",
      icon: GlobeIcon,
      count: countries,
      label: t("counts.countries", { count: countries }),
    })
  }
  return parts
}

/** Type-appropriate "no restrictions" label. */
export function couponScopeFallback(coupon: Coupon, t: Translate): string {
  switch (normalizeCouponType(coupon.type)) {
    case "free_shipping":
      return t("scopeSummary.allCountries")
    case "amount_off_order":
      return t("scopeSummary.entireOrder")
    default:
      return t("scopeSummary.allProducts")
  }
}

/**
 * Short label summarising a coupon's restrictions for the list table —
 * whichever lists are populated, joined the way `locale` lists them
 * ("3 products, 2 collections"), or the type-appropriate "all" message
 * when nothing is set.
 */
export function couponScopeLabel(
  coupon: Coupon,
  t: Translate,
  locale: string,
): string {
  const parts = couponScopeParts(coupon, t)
  if (parts.length > 0) return formatList(parts.map((p) => p.label), locale)
  return couponScopeFallback(coupon, t)
}

/**
 * Human-readable value for a coupon, e.g. "20%", "SAR 50 off" or
 * "Buy 2 get 1 free". `t` is the `coupons` translator.
 */
export function couponValue(
  coupon: Coupon,
  t: Translate,
  currency?: string,
): string {
  switch (normalizeCouponType(coupon.type)) {
    case "amount_off_products":
    case "amount_off_order": {
      // Wire format is uppercase ("PERCENTAGE"); older paths may have
      // normalized to lowercase — accept both so the rendered value
      // doesn't silently fall back to "SAR X off" when the server says %.
      const vt = coupon.value_type?.toString().toLowerCase()
      if (vt === "percentage") {
        // PERCENTAGE coupons carry their value in `percent_bps`; FIXED
        // coupons in `amount_cents`. Reading the wrong field renders `0%`.
        const percent = bpsToPercent(coupon.percent_bps)
        return coupon.max_discount_cents
          ? t("value.percentUpTo", {
              percent,
              max: formatMoneyCents(coupon.max_discount_cents, currency),
            })
          : `${percent}%`
      }
      return t("value.amountOff", {
        amount: formatMoneyCents(coupon.amount_cents, currency),
      })
    }
    case "free_shipping":
      return t("kinds.free_shipping.label")
    case "buy_x_get_y":
      return bogoValue(coupon, t, currency)
    default:
      return "—"
  }
}

/**
 * "Buy 2 get 1", with the reward folded into the same message rather than an
 * English suffix appended to it — Arabic puts the reward somewhere else.
 */
function bogoValue(coupon: Coupon, t: Translate, currency?: string): string {
  const buy = coupon.buy_quantity ?? 0
  const get = coupon.get_quantity ?? 0
  const mode = coupon.get_discount_type?.toString().toUpperCase()
  if (mode === "FREE") return t("value.bogoFree", { buy, get })
  if (mode === "AMOUNT" && coupon.get_discount_amount_cents) {
    return t("value.bogoAmountOff", {
      buy,
      get,
      amount: formatMoneyCents(coupon.get_discount_amount_cents, currency),
    })
  }
  const percent =
    coupon.get_discount_percent_bps != null
      ? bpsToPercent(coupon.get_discount_percent_bps)
      : null
  if (mode === "PERCENT" && percent != null) {
    return percent === 100
      ? t("value.bogoFree", { buy, get })
      : t("value.bogoPercentOff", { buy, get, percent })
  }
  // Fallback for older data that didn't carry get_discount_type.
  if (percent != null && percent !== 100) {
    return t("value.bogoPercentOff", { buy, get, percent })
  }
  return t("value.bogo", { buy, get })
}
