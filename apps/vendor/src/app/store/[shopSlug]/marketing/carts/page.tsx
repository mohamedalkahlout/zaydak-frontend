import { Suspense } from "react"
import { Skeleton } from "@repo/ui/components/skeleton"
import { AbandonedCartsScreen } from "@/features/abandoned-carts"

/**
 * Authenticated list — do not `PreloadQuery`. The vendor RSC Apollo client
 * does not send the access token, so `abandonedCarts` / `abandonedCartsSummary`
 * (JwtAuthGuard) fail on the server and Apollo streaming falls back with
 * "Authentication required". The child fetches with `useQuery` in the browser.
 *
 * The Suspense boundary is only for `useSearchParams` on the client screen.
 */
export default async function AbandonedCartsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <Suspense fallback={<AbandonedCartsSkeleton />}>
      <AbandonedCartsScreen />
    </Suspense>
  )
}

function AbandonedCartsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-3">
        <Skeleton className="mb-3 h-9 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
