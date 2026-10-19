import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_DRAFT_ORDERS } from "@/features/orders/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { DraftOrdersList } from "@/features/orders/components/drafts/draft-orders-list"

export default async function DraftOrdersPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return (
    <PreloadQuery query={GET_DRAFT_ORDERS} variables={{ page: 1, limit: 50 }}>
      <Suspense fallback={<Loading />}>
        <DraftOrdersList />
      </Suspense>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="my-2 h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
