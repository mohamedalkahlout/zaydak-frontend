import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_PRODUCTS } from "@/features/products/api"
import { Skeleton } from "@repo/ui/components/skeleton"
import { ProductsTable } from "@/features/products/components/list/products-table"
import { PAGE_SIZE } from "@/features/products/lib/list/constants"
import {
  parseProductListQueryState,
  toProductListVariables,
} from "@/features/products/lib/list/query-state"

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await params
  const rawSearchParams = await searchParams
  const queryState = parseProductListQueryState(rawSearchParams, PAGE_SIZE)
  const variables = toProductListVariables(queryState)

  return (
    <PreloadQuery query={GET_PRODUCTS} variables={variables}>
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsTable />
      </Suspense>
    </PreloadQuery>
  )
}

function ProductsSkeleton() {
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
