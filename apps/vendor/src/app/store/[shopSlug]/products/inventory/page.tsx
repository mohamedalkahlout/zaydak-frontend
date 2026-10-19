import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import {
  GET_INVENTORY_ITEMS,
  GET_INVENTORY_LOCATIONS,
} from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { InventoryItemsPage } from "@/features/inventory/components/items/inventory-items-page"

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <PreloadQuery query={GET_INVENTORY_ITEMS} variables={{ page: 1, limit: 25 }}>
        <Suspense fallback={<InventorySkeleton />}>
          <InventoryItemsPage />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function InventorySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="rounded-2xl border border-border bg-card">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="my-2 mx-3 h-10" />
        ))}
      </div>
    </div>
  )
}
