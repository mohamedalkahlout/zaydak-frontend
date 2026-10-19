import { CollectionEditor } from "@/features/collections"

export default async function NewCollectionPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params
  return (
    <div className="lg:mx-8">
      <CollectionEditor />
    </div>
  )
}
