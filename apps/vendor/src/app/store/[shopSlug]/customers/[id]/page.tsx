import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_CONTACT_BY_ID } from "@/features/customers/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { CustomerDetail } from "@/features/customers/components/detail/customer-detail"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { id } = await params

  return (
    <div className="lg:mx-12">
      <PreloadQuery query={GET_CONTACT_BY_ID} variables={{ id }}>
        <Suspense fallback={<CustomerDetailSkeleton />}>
          <CustomerDetail id={id} />
        </Suspense>
      </PreloadQuery>
    </div>
  )
}

function CustomerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
