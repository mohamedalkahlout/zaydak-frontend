"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@repo/ui/components/badge"
import { cn } from "@/shared/lib/utils"
import type { CouponType } from "@/features/coupons/types"
import {
  COUPON_STATUS_STYLE,
  COUPON_TYPE_STYLE,
  couponStatusKey,
  couponTypeKey,
  type CouponStatus,
} from "@/features/coupons/lib/list/constants"
import { normalizeCouponType } from "@/features/coupons/lib/list/helpers"

/**
 * Only the tints are local. The words come from the same message keys the
 * filter menu offering that value reads — and, for the type, from the very
 * entries the create-coupon dialog renders — so no surface can drift from
 * another.
 */
export function CouponTypeBadge({ type }: { type: CouponType | string }) {
  const t = useTranslations("coupons")
  const key = normalizeCouponType(type)
  const messageKey = couponTypeKey(key)
  // A type the server invents renders as its raw id rather than a
  // missing-message path in a table cell.
  const label = t.has(messageKey) ? t(messageKey) : key
  const style = COUPON_TYPE_STYLE[key] ?? "bg-zinc-100 text-zinc-700"
  return <Badge className={cn("h-6 rounded-md px-2.5", style)}>{label}</Badge>
}

export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  const t = useTranslations("coupons")
  const messageKey = couponStatusKey(status)
  const label = t.has(messageKey) ? t(messageKey) : status
  return (
    <Badge className={cn("h-6 rounded-md px-2.5", COUPON_STATUS_STYLE[status])}>
      {label}
    </Badge>
  )
}
