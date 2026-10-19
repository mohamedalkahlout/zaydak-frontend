import { Suspense } from "react"
import { Skeleton } from "@repo/ui/components/skeleton"
import { AdsIntegrations } from "@/features/ads"

export default function AdsIntegrationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <AdsIntegrations />
    </Suspense>
  )
}
