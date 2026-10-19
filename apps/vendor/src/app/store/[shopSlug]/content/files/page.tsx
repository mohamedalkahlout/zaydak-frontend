import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_FILES } from "@/features/files/api"
import { FilesPage } from "@/features/files/components/files-page"
import { PAGE_SIZE } from "@/features/files/lib/list/constants"
import {
  parseFilesListQueryState,
  toFilesListVariables,
} from "@/features/files/lib/list/query-state"

export default async function ContentFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await params
  const rawSearchParams = await searchParams
  const queryState = parseFilesListQueryState(rawSearchParams, PAGE_SIZE)
  const variables = toFilesListVariables(queryState)

  return (
    <PreloadQuery query={GET_FILES} variables={variables}>
      <Suspense fallback={<FilesSkeleton />}>
        <FilesPage />
      </Suspense>
    </PreloadQuery>
  )
}

function FilesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="mb-4 h-9 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
