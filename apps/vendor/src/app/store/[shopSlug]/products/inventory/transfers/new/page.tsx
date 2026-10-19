import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { TransferNewPage } from "@/features/inventory/components/transfers/transfer-new-page"

export default async function NewTransferPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery
        query={GET_PRODUCTS}
        variables={{ filters: { page: 1, limit: 50 } }}
      >
        <Suspense fallback={<Loading />}>
          <TransferNewPage />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
