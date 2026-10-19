import { AnalyticsOverview } from "@/features/analytics"

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  // The dashboard is shop-scoped via the X-SHOP header (Apollo reads the active
  // shop slug); the overview is a client island that drives its own queries.
  await params

  return <AnalyticsOverview />
}
