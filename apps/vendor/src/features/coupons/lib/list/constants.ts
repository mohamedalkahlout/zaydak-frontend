import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarXIcon,
  GiftIcon,
  InboxIcon,
  TagIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react"
import type { FilterValueOption } from "@/shared/components/filter-bar"
import type { CouponType } from "@/features/coupons/types"
import type {
  CouponScopeFilter,
  CouponStatusFilter,
} from "./query-state"

export const PAGE_SIZE = 8

/**
 * Where a coupon type's words live, as a key rather than the words.
 *
 * It resolves the very messages the create-coupon dialog already renders
 * (`coupons.kinds.<type>.label`) rather than a second list of the same four
 * names — which is what the English `Record` here used to be, read by the type
 * badge while the dialog beside it read the catalogue.
 */
export const couponTypeKey = (type: CouponType | string) =>
  `kinds.${type}.label`

/** The status bucket's words, under `coupons.status.<value>`. */
export const couponStatusKey = (status: CouponStatusFilter | string) =>
  `status.${status}`

/** The scope bucket's words, under `coupons.scope.<value>`. */
export const couponScopeKey = (scope: CouponScopeFilter | string) =>
  `scope.${scope}`

export const COUPON_TYPE_STYLE: Record<CouponType, string> = {
  amount_off_products: "bg-violet-100 text-violet-900",
  amount_off_order: "bg-blue-100 text-blue-900",
  buy_x_get_y: "bg-amber-100 text-amber-900",
  free_shipping: "bg-sky-100 text-sky-900",
}

/**
 * Meta used by the create-coupon dialog: icon + merchant-priority order.
 *
 * It carries no copy — the dialog looks the row's label and description up by
 * the enum (`coupons.kinds.<type>.{label,description}`), the same shape the
 * products kind picker uses, so the two mirrors stay mirrors. The filter menu
 * and the type badge now read the same catalogue through `couponTypeKey`.
 */
export const COUPON_TYPE_META: {
  value: CouponType
  icon: LucideIcon
}[] = [
  { value: "amount_off_products", icon: TagIcon },
  { value: "buy_x_get_y", icon: GiftIcon },
  { value: "amount_off_order", icon: InboxIcon },
  { value: "free_shipping", icon: TruckIcon },
]

export const COUPON_TYPE_OPTIONS: readonly FilterValueOption<CouponType>[] =
  COUPON_TYPE_META

// Live status bucket computed from dates on the client for display.
export type CouponStatus = CouponStatusFilter

export const COUPON_STATUS_STYLE: Record<CouponStatus, string> = {
  scheduled: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  expired: "bg-zinc-100 text-zinc-700",
}

export const COUPON_STATUS_OPTIONS: readonly FilterValueOption<CouponStatus>[] =
  [
    { value: "active", icon: CalendarCheckIcon },
    { value: "scheduled", icon: CalendarClockIcon },
    { value: "expired", icon: CalendarXIcon },
  ]

export type CouponScope = CouponScopeFilter

export const COUPON_SCOPE_OPTIONS: readonly FilterValueOption<CouponScope>[] = [
  { value: "general" },
  { value: "scoped" },
]
