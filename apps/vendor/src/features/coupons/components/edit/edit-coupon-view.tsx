"use client"

import { notFound } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { GET_COUPON_BY_ID } from "@/features/coupons/api"
import type { CouponEntry } from "@/shared/api/generated/graphql"
import { AmountOffOrderCouponForm } from "../new/forms/amount-off-order-form"
import { AmountOffProductsCouponForm } from "../new/forms/amount-off-products-form"
import { BuyXGetYCouponForm } from "../new/forms/bogo-form"
import { FreeShippingCouponForm } from "../new/forms/free-shipping-form"
import {
  couponEntryType,
  extractInitialSnapshots,
  fromCouponEntry,
} from "../../lib/new/from-coupon-entry"
import type {
  AmountOffOrderCouponInput,
  AmountOffProductsCouponInput,
  BuyXGetYCouponInput,
  FreeShippingCouponInput,
} from "@/features/coupons/validations/coupon"
import { CouponPerformanceCard } from "./coupon-performance-card"

interface Response {
  coupon: {
    success: boolean
    data?: CouponEntry | null
  }
}

export function EditCouponView({ id }: { id: string }) {
  const { data } = useSuspenseQuery<Response>(GET_COUPON_BY_ID, {
    variables: { id },
  })

  const entry = data?.coupon?.data
  if (!entry) notFound()

  const type = couponEntryType(entry)
  if (!type) notFound()

  const initialValues = fromCouponEntry(entry)
  const initialSnapshots = extractInitialSnapshots(entry)

  const performanceAction = <CouponPerformanceCard couponId={entry.id} />

  return renderForm(
    type,
    entry,
    initialValues,
    initialSnapshots,
    performanceAction,
  )
}

function renderForm(
  type: ReturnType<typeof couponEntryType>,
  entry: CouponEntry,
  initialValues: ReturnType<typeof fromCouponEntry>,
  initialSnapshots: ReturnType<typeof extractInitialSnapshots>,
  headerAction: React.ReactNode,
) {
  switch (type) {
    case "amount_off_products":
      return (
        <AmountOffProductsCouponForm
          mode="edit"
          couponId={entry.id}
          initialValues={initialValues as AmountOffProductsCouponInput}
          initialSnapshots={initialSnapshots}
          headerAction={headerAction}
        />
      )
    case "amount_off_order":
      return (
        <AmountOffOrderCouponForm
          mode="edit"
          couponId={entry.id}
          initialValues={initialValues as AmountOffOrderCouponInput}
          initialSnapshots={initialSnapshots}
          headerAction={headerAction}
        />
      )
    case "buy_x_get_y":
      return (
        <BuyXGetYCouponForm
          mode="edit"
          couponId={entry.id}
          initialValues={initialValues as BuyXGetYCouponInput}
          initialSnapshots={initialSnapshots}
          headerAction={headerAction}
        />
      )
    case "free_shipping":
      return (
        <FreeShippingCouponForm
          mode="edit"
          couponId={entry.id}
          initialValues={initialValues as FreeShippingCouponInput}
          initialSnapshots={initialSnapshots}
          headerAction={headerAction}
        />
      )
    default:
      return null
  }
}
