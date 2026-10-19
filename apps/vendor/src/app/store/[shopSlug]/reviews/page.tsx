import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  GET_SHOP_REVIEWS,
  GET_SHOP_REVIEWS_SUMMARY,
} from "@/features/reviews/api"
import { PAGE_SIZE } from "@/features/reviews/lib/reviews"
import { ReviewsScreen } from "@/features/reviews"

/**
 * Both queries are preloaded on the server, so the first paint carries data.
 *
 * The variables here must match the screen's initial `useQuery` variables
 * exactly — including the explicit nulls — or the client asks a second time
 * and the preload buys nothing.
 */
export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_SHOP_REVIEWS_SUMMARY}>
      <PreloadQuery
        query={GET_SHOP_REVIEWS}
        variables={{
          page: 1,
          limit: PAGE_SIZE,
          rating: null,
          product_id: null,
          search: null,
          sort: "NEWEST",
        }}
      >
        <Suspense fallback={<ReviewsSkeleton />}>
          <ReviewsScreen />
        </Suspense>
      </PreloadQuery>
    </PreloadQuery>
  )
}

function ReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="rounded-xl border border-border bg-card p-3">
        <Skeleton className="mb-3 h-9 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-16 w-full" />
        ))}
      </div>
    </div>
  )
}
