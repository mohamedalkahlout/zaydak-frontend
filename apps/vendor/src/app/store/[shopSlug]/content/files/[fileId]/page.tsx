import { Suspense } from "react"
import { Loader2Icon } from "lucide-react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_FILE } from "@/features/files/api"
import { FileViewPage } from "@/features/files/components/file-view-page"

/**
 * The file view — the full-screen image editor and its AI Studio, as a route.
 *
 * It sits under the files list segment so the URL reads as what it is
 * (`/content/files/:fileId`) and the dashboard layout still runs its auth and
 * shop checks. The editor covers the dashboard chrome itself.
 */
export default async function FileViewRoute({
  params,
}: {
  params: Promise<{ shopSlug: string; fileId: string }>
}) {
  const { fileId } = await params

  return (
    // A route can be opened with any id — stale bookmark, deleted file,
    // another shop's — and the view renders a real screen for that. Matching
    // the hook's errorPolicy keeps the preloaded ref usable instead of making
    // the client refetch under different options.
    <PreloadQuery
      query={GET_FILE}
      variables={{ id: fileId }}
      errorPolicy="all"
    >
      <Suspense fallback={<FileViewSkeleton />}>
        <FileViewPage />
      </Suspense>
    </PreloadQuery>
  )
}

/** Matches the editor's dark full-screen chrome so there is no light flash. */
function FileViewSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
      <Loader2Icon className="size-8 animate-spin text-neutral-500" />
    </div>
  )
}
