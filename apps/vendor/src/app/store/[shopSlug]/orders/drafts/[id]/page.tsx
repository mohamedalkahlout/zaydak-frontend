import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_DRAFT_ORDER } from "@/features/orders/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { DraftOrderEditPage } from "@/features/orders/components/drafts/draft-order-edit-page"

export default async function DraftOrderDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <PreloadQuery query={GET_DRAFT_ORDER} variables={{ id }}>
      <Suspense fallback={<Loading />}>
        <DraftOrderEditPage id={id} />
      </Suspense>
    </PreloadQuery>
  )
}

function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}
