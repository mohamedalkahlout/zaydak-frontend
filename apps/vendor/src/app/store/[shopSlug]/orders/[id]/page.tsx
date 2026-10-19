import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_ORDER_BY_ID } from "@/features/orders/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { OrderDetailView } from "@/features/orders/components/detail/order-detail-view"

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <PreloadQuery query={GET_ORDER_BY_ID} variables={{ id }}>
      <Suspense fallback={<OrderDetailSkeleton />}>
        <OrderDetailView id={id} />
      </Suspense>
    </PreloadQuery>
  )
}

function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
