import { AttributionReport } from "@/features/attribution"

export default async function AttributionRoute({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <AttributionReport />
}
