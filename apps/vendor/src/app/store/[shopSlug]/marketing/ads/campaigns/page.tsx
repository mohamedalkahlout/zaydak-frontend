import { Suspense } from "react"
import { Skeleton } from "@repo/ui/components/skeleton"
import { AdsManagement } from "@/features/ads"

export default function AdsCampaignsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <AdsManagement />
    </Suspense>
  )
}
