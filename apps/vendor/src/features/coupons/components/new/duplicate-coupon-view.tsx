"use client"

import { notFound } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { GET_COUPON_BY_ID } from "@/features/coupons/api"
import { duplicateCouponCode } from "@/features/coupons/lib/list/duplicate"
import {
  couponEntryType,
  extractInitialSnapshots,
  fromCouponEntry,
} from "@/features/coupons/lib/new/from-coupon-entry"
import type { CouponType } from "@/features/coupons/types"
import type {
  AmountOffOrderCouponInput,
  AmountOffProductsCouponInput,
  BuyXGetYCouponInput,
  FreeShippingCouponInput,
} from "@/features/coupons/validations/coupon"
import type { CouponEntry } from "@/shared/api/generated/graphql"
import { AmountOffOrderCouponForm } from "./forms/amount-off-order-form"
import { AmountOffProductsCouponForm } from "./forms/amount-off-products-form"
import { BuyXGetYCouponForm } from "./forms/bogo-form"
import { FreeShippingCouponForm } from "./forms/free-shipping-form"

interface Response {
  coupon: {
    success: boolean
    data?: CouponEntry | null
  }
}

/**
 * The create form for the row menu's Duplicate. Same fields as the source
 * coupon, a new code, and `create` rather than `update`.
 */
export function DuplicateCouponView({
  id,
  type,
}: {
  id: string
  type: CouponType
}) {
  const { data } = useSuspenseQuery<Response>(GET_COUPON_BY_ID, {
    variables: { id },
  })

  const entry = data?.coupon?.data
  if (!entry) notFound()

  const entryType = couponEntryType(entry)
  if (!entryType || entryType !== type) notFound()

  const seeded = fromCouponEntry(entry)
  const initialValues = {
    ...seeded,
    code: duplicateCouponCode(seeded.code),
  }
  const initialSnapshots = extractInitialSnapshots(entry)

  switch (entryType) {
    case "amount_off_products":
      return (
        <AmountOffProductsCouponForm
          mode="create"
          initialValues={initialValues as AmountOffProductsCouponInput}
          initialSnapshots={initialSnapshots}
        />
      )
    case "amount_off_order":
      return (
        <AmountOffOrderCouponForm
          mode="create"
          initialValues={initialValues as AmountOffOrderCouponInput}
          initialSnapshots={initialSnapshots}
        />
      )
    case "buy_x_get_y":
      return (
        <BuyXGetYCouponForm
          mode="create"
          initialValues={initialValues as BuyXGetYCouponInput}
          initialSnapshots={initialSnapshots}
        />
      )
    case "free_shipping":
      return (
        <FreeShippingCouponForm
          mode="create"
          initialValues={initialValues as FreeShippingCouponInput}
          initialSnapshots={initialSnapshots}
        />
      )
  }
}
