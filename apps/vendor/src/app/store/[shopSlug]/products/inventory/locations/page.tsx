import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_INVENTORY_LOCATIONS } from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { LocationsPage } from "@/features/inventory/components/locations/locations-page"

export default async function InventoryLocationsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_INVENTORY_LOCATIONS}>
      <Suspense fallback={<LocationsSkeleton />}>
        <LocationsPage />
      </Suspense>
    </PreloadQuery>
  )
}

function LocationsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}
