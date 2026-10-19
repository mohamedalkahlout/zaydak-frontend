import { PlanDetail } from "@/features/plans/components/plan-detail"

export default async function PlanSubscribersPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  return <PlanDetail planId={planId} />
}
