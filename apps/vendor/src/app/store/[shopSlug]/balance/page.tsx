import { BalanceDashboard } from "@/features/balance/components/balance-dashboard"

export default async function BalancePage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  return <BalanceDashboard shopSlug={shopSlug} />
}
