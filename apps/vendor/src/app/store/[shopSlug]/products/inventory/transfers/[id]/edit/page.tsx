import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import {
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_TRANSFER,
} from "@/features/inventory/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { TransferEditPage } from "@/features/inventory/components/transfers/transfer-edit-page"

export default async function EditTransferPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery
        query={GET_PRODUCTS}
        variables={{ filters: { page: 1, limit: 50 } }}
      >
        <PreloadQuery query={GET_INVENTORY_TRANSFER} variables={{ id }}>
          <Suspense fallback={<Loading />}>
            <TransferEditPage transferId={id} />
          </Suspense>
        </PreloadQuery>
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
