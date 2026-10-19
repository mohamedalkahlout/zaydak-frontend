import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon, UsersIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { SegmentInsights, SegmentTabs } from "@/features/segments"

/**
 * Segment Insights tab — analytics dashboard for a saved segment.
 *
 * Route: /store/[shopSlug]/segments/[id]/insights
 *
 * Loads `segmentInsights(id)` client-side (the analytics queries are
 * Apollo `useQuery` with cache-and-network). The page itself is a Server
 * Component that just renders the breadcrumb + tab nav + the client
 * component.
 */
export default async function SegmentInsightsPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>
}) {
  const { shopSlug, id } = await params
  const t = await getTranslations("segments")

  return (
    <div className="lg:mx-12">
      <div className="flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            nativeButton={false}
            render={<Link href={`/store/${shopSlug}/segments`} />}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <UsersIcon className="size-4" />
          <Link
            href={`/store/${shopSlug}/segments`}
            className="hover:underline"
          >
            {t("title")}
          </Link>
          <span>›</span>
          <Link
            href={`/store/${shopSlug}/segments/${id}`}
            className="hover:underline"
          >
            {t("insightsPage.segment")}
          </Link>
          <span>›</span>
          <span className="font-medium text-foreground">
            {t("tabs.insights")}
          </span>
        </div>

        <SegmentTabs shopSlug={shopSlug} segmentId={id} />

        <SegmentInsights segmentId={id} />
      </div>
    </div>
  )
}
