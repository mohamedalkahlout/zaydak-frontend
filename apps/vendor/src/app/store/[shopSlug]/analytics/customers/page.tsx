import { CustomerAnalyticsPage } from "@/features/customer-analytics"

export default async function CustomerAnalyticsRoute({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <CustomerAnalyticsPage />
}
