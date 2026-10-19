import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_SUPPLIERS } from "@/features/inventory/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { SuppliersPage } from "@/features/inventory/components/suppliers/suppliers-page"

export default async function Page({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_SUPPLIERS}>
      <Suspense fallback={<Loading />}>
        <SuppliersPage />
      </Suspense>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
