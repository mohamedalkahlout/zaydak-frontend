import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_SEGMENTS } from "@/features/segments/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { SegmentsTable } from "@/features/segments/components/segments-table"

export default async function SegmentsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_SEGMENTS} variables={{ page: 1, limit: 50 }}>
      <Suspense fallback={<SegmentsSkeleton />}>
        <SegmentsTable />
      </Suspense>
    </PreloadQuery>
  )
}

function SegmentsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-3">
        <Skeleton className="mb-3 h-9 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
