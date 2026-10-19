import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_PRODUCT_BY_SLUG } from "@/features/products/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { EditProductView } from "@/features/products/components/edit/edit-product-view"

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ shopSlug: string; slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="lg:mx-12">
      <PreloadQuery query={GET_PRODUCT_BY_SLUG} variables={{ slug }}>
        <Suspense fallback={<EditProductSkeleton />}>
          <EditProductView slug={slug} />
        </Suspense>
      </PreloadQuery>
    </div>
  )
}

function EditProductSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}
