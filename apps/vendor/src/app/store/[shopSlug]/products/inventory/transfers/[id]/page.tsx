import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import {
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_TRANSFER,
} from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { TransferDetailPage } from "@/features/inventory/components/transfers/transfer-detail-page"

export default async function TransferDetail({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery query={GET_INVENTORY_TRANSFER} variables={{ id }}>
        <Suspense fallback={<Loading />}>
          <TransferDetailPage transferId={id} />
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
