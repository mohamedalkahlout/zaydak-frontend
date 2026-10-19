import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format"
import type { Translate } from "@/shared/i18n/translator"
import type { CouponSummary, CouponType } from "@/features/ai/lib/types"

// Every helper here takes a translator scoped to `aiChat.toolCards.coupons`.

/** Localized coupon-type label. */
export function couponTypeLabel(type: CouponType, t: Translate): string {
  return t(`type.${type}`)
}

/** Human discount value: "20%", "50.00 SAR", "Free shipping", or the
 * backend's pre-computed BOGO label. */
export function couponDiscountText(
  c: Pick<
    CouponSummary,
    "type" | "percent_bps" | "amount_cents" | "currency" | "discount_label"
  >,
  t: Translate,
): string {
  if (c.type === "free_shipping") return t("freeShipping")
  if (c.type === "buy_x_get_y") return c.discount_label || "—"
  if (c.percent_bps != null) return `${bpsToPercent(c.percent_bps)}%`
  if (c.amount_cents != null) return formatMoneyCents(c.amount_cents, c.currency)
  return c.discount_label || "—"
}

const STATUS_CLASS: Record<CouponSummary["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  scheduled: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  expired: "bg-muted text-muted-foreground",
}

/** Status pill label + Tailwind color classes. */
export function couponStatusMeta(
  status: CouponSummary["status"],
  t: Translate,
): { label: string; className: string } {
  return { label: t(`status.${status}`), className: STATUS_CLASS[status] }
}
