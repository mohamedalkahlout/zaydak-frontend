import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_RETURNS } from "@/features/returns/api"
import { ReturnsList } from "@/features/returns/components/returns-list"

export default async function ReturnsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_RETURNS} variables={{ page: 1, limit: 50 }}>
      <Suspense fallback={<Loading />}>
        <ReturnsList />
      </Suspense>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-32" />
      <div className="rounded-xl border border-border bg-card p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
