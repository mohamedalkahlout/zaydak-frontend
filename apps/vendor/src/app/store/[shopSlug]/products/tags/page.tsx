import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_TAGS } from "@/features/tags/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { TagsView } from "@/features/tags"

export default async function TagsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_TAGS} variables={{ page: 1, limit: 100 }}>
      <Suspense fallback={<TagsSkeleton />}>
        <TagsView />
      </Suspense>
    </PreloadQuery>
  )
}

function TagsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
