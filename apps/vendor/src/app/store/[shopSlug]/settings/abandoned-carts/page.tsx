import { Suspense } from "react"
import { PreloadQuery } from "@/shared/lib/apollo"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_ABANDONED_CHECKOUT_SETTING } from "@/features/abandoned-carts/api"
import { AbandonedCartsPane } from "@/features/settings"

/**
 * Settings → Abandoned cart reminders — the shop's `abandoned_checkout`
 * cadence (enable switch + the existing T+1h / T+24h / T+72h steps).
 */
export default function SettingsAbandonedCartsPage() {
  return (
    <PreloadQuery query={GET_ABANDONED_CHECKOUT_SETTING}>
      <Suspense fallback={<AbandonedCartsSettingsSkeleton />}>
        <AbandonedCartsPane />
      </Suspense>
    </PreloadQuery>
  )
}

function AbandonedCartsSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-3 h-14 w-full rounded-lg" />
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-20 w-full rounded-lg" />
      </div>
    </div>
  )
}
