import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_SEGMENT_BY_ID } from "@/features/segments/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { SegmentDetail } from "@/features/segments/components/segment-detail"

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <div className="lg:mx-12">
      <PreloadQuery query={GET_SEGMENT_BY_ID} variables={{ id }}>
        <Suspense fallback={<SegmentDetailSkeleton />}>
          <SegmentDetail id={id} />
        </Suspense>
      </PreloadQuery>
    </div>
  )
}

function SegmentDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
