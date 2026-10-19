import { Suspense } from "react"
import { Skeleton } from "@repo/ui/components/skeleton"
import { PreloadQuery } from "@/shared/lib/apollo"
import { GET_SHOP_COLLECTION_BY_ID } from "@/features/collections/api"
import { CollectionEditorLoader } from "@/features/collections"

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ shopSlug: string; collectionId: string }>
}) {
  const { collectionId } = await params

  return (
    <div className="lg:mx-8">
      <PreloadQuery
        query={GET_SHOP_COLLECTION_BY_ID}
        variables={{ id: collectionId }}
      >
        <Suspense fallback={<EditorSkeleton />}>
          <CollectionEditorLoader id={collectionId} />
        </Suspense>
      </PreloadQuery>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
