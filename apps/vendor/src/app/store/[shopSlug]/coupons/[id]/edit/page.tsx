import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_COUPON_BY_ID } from "@/features/coupons/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { EditCouponView } from "@/features/coupons/components/edit/edit-coupon-view"

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <div className="lg:mx-12">
      <PreloadQuery query={GET_COUPON_BY_ID} variables={{ id }}>
        <Suspense fallback={<EditCouponSkeleton />}>
          <EditCouponView id={id} />
        </Suspense>
      </PreloadQuery>
    </div>
  )
}

function EditCouponSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
