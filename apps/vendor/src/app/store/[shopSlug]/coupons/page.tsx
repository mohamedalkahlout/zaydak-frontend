import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_COUPONS } from "@/features/coupons/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { PAGE_SIZE } from "@/features/coupons/lib/list/constants"
import { toCouponListVariables } from "@/features/coupons/lib/list/query-state"
import { CouponsTable } from "@/features/coupons/components/list/coupons-table"

/**
 * Do not read `searchParams` here. The list owns filters in FilterBar chips
 * and writes the URL with `router.replace`; if this RSC re-ran PreloadQuery
 * on every `?statuses=` change, `useSuspenseQuery` would suspend, the table
 * would remount as a skeleton, and in-progress chips would be rebuilt from
 * the new URL (an empty chip writes nothing, so it would vanish).
 */
export default async function CouponsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery
      query={GET_COUPONS}
      variables={toCouponListVariables({ page: 1, limit: PAGE_SIZE })}
    >
      <Suspense fallback={<CouponsSkeleton />}>
        <CouponsTable />
      </Suspense>
    </PreloadQuery>
  )
}

function CouponsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
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
