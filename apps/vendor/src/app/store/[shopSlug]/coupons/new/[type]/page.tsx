import { Suspense } from "react"
import { notFound } from "next/navigation"
import { Skeleton } from "@repo/ui/components/skeleton"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_COUPON_BY_ID } from "@/features/coupons/api"
import { DuplicateCouponView } from "@/features/coupons/components/new/duplicate-coupon-view"
import type { CouponType } from "@/features/coupons/types"
import { AmountOffOrderCouponForm } from "@/features/coupons/components/new/forms/amount-off-order-form"
import { AmountOffProductsCouponForm } from "@/features/coupons/components/new/forms/amount-off-products-form"
import { BuyXGetYCouponForm } from "@/features/coupons/components/new/forms/bogo-form"
import { FreeShippingCouponForm } from "@/features/coupons/components/new/forms/free-shipping-form"

const FORMS: Record<CouponType, () => React.ReactElement> = {
  amount_off_products: AmountOffProductsCouponForm,
  amount_off_order: AmountOffOrderCouponForm,
  buy_x_get_y: BuyXGetYCouponForm,
  free_shipping: FreeShippingCouponForm,
}

const VALID_TYPES = [
  "amount_off_products",
  "amount_off_order",
  "buy_x_get_y",
  "free_shipping",
] as const satisfies readonly CouponType[]

export default async function NewCouponPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string; type: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { type } = await params
  const { from } = await searchParams
  const normalizedType = decodeURIComponent(type).trim().toLowerCase()

  if (!VALID_TYPES.includes(normalizedType as CouponType)) notFound()

  const sourceId = Array.isArray(from) ? from[0] : from
  if (sourceId) {
    return (
      <div className="lg:mx-12">
        <PreloadQuery query={GET_COUPON_BY_ID} variables={{ id: sourceId }}>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <DuplicateCouponView
              id={sourceId}
              type={normalizedType as CouponType}
            />
          </Suspense>
        </PreloadQuery>
      </div>
    )
  }

  const FormComponent = FORMS[normalizedType as CouponType]
  return (
    <div className="lg:mx-12">
      <FormComponent />
    </div>
  )
}
