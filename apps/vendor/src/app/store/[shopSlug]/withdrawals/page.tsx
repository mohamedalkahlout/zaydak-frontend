import { BalanceDashboard } from "@/features/balance/components/balance-dashboard"

export default async function WithdrawalsPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  return <BalanceDashboard shopSlug={shopSlug} />
}
