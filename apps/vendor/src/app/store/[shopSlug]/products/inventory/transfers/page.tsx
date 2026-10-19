import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import {
  GET_INVENTORY_LOCATIONS,
  GET_INVENTORY_TRANSFERS,
} from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { TransfersListPage } from "@/features/inventory/components/transfers/transfers-list-page"

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery query={GET_INVENTORY_TRANSFERS} variables={{ page: 1, limit: 25 }}>
        <Suspense fallback={<Loading />}>
          <TransfersListPage />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
