import { PlanDetail } from "@/features/plans/components/plan-detail"

/**
 * The same detail screen; the tab comes from the pathname.
 *
 * A page per tab rather than a query string, so "the capabilities on Grow" is a
 * link — and so the browser's back button steps between tabs the way it does
 * between anything else.
 */
export default async function PlanCapabilitiesPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  return <PlanDetail planId={planId} />
}
