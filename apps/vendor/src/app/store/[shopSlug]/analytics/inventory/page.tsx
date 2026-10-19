import { InventoryAnalyticsPage } from "@/features/inventory-analytics"

export default async function InventoryAnalyticsRoute({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  await params

  return <InventoryAnalyticsPage />
}
