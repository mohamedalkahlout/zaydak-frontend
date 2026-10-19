import { Suspense } from "react"
import { redirect } from "next/navigation"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_MY_PLAN } from "@/features/plan/api/queries"
import { PlanPane } from "@/features/settings"

/**
 * The Plan pane, at its own URL.
 *
 * This path used to be a pure redirect to `/plan/{shopSlug}`, from before Plan
 * became a pane again (2026-08-14). It is a pane now — but one job of the old
 * redirect survives: **a Stripe Checkout session returns with `?billing=`**,
 * and the acknowledgement plus the poll that waits for the webhook live on
 * `/plan/{shopSlug}`, not here. Forwarding only when `billing` is present keeps
 * both: a vendor who just paid lands where the receipt is, everyone else gets
 * the pane.
 *
 * The whole query string travels. Dropping it would swallow the payment
 * acknowledgement.
 */
export default async function SettingsPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { shopSlug } = await params
  const query = await searchParams

  if ("billing" in query) {
    const rest = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") rest.set(key, value)
      else if (Array.isArray(value)) value.forEach((v) => rest.append(key, v))
    }
    const suffix = rest.toString()
    redirect(`/plan/${shopSlug}${suffix ? `?${suffix}` : ""}`)
  }

  // `myPlan` starts on the server so the pane streams with the plan in it —
  // preload + `useSuspenseQuery`, same shape as the storefront.
  return (
    <PreloadQuery query={GET_MY_PLAN}>
      <Suspense fallback={<PlanSkeleton />}>
        <PlanPane />
      </Suspense>
    </PreloadQuery>
  )
}

function PlanSkeleton() {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-3 h-16 w-full rounded-lg" />
    </div>
  )
}
