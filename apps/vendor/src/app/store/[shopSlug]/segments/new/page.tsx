import { SegmentEditor } from "@/features/segments/components/segment-editor"

export default async function NewSegmentPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params
  return (
    <div className="lg:mx-12">
      <SegmentEditor mode="create" />
    </div>
  )
}
