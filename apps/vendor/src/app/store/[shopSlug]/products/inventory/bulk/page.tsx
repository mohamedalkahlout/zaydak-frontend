import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { BulkInventoryEditor } from "@/features/inventory/components/bulk/bulk-inventory-editor"

export default async function BulkInventoryPage({
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
        <Suspense fallback={<BulkSkeleton />}>
          <BulkInventoryEditor />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function BulkSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <Skeleton className="mb-3 h-9 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
