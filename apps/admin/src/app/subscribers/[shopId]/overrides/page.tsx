import { SubscriberDetail } from "@/features/plans/components/subscriber-detail"

export default async function SubscriberOverridesPage({
  params,
}: {
  params: Promise<{ shopId: string }>
}) {
  const { shopId } = await params
  return <SubscriberDetail shopId={shopId} />
}
