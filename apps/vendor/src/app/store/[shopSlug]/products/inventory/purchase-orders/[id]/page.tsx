import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import {
  GET_PURCHASE_ORDER,
  GET_INVENTORY_LOCATIONS,
} from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { PurchaseOrderDetailPage } from "@/features/inventory/components/purchase-orders/purchase-order-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery query={GET_PURCHASE_ORDER} variables={{ id }}>
        <Suspense fallback={<Loading />}>
          <PurchaseOrderDetailPage poId={id} />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
