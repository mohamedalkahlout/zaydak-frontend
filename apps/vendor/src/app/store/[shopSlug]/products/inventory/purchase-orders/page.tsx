import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import {
  GET_PURCHASE_ORDERS,
  GET_INVENTORY_LOCATIONS,
} from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { PurchaseOrdersListPage } from "@/features/inventory/components/purchase-orders/purchase-orders-list-page"

export default async function Page({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery query={GET_PURCHASE_ORDERS} variables={{ page: 1, limit: 25 }}>
        <Suspense fallback={<Loading />}>
          <PurchaseOrdersListPage />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
