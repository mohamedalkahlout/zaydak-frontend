"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { TrendingUpIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/ui/components/hover-card"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_COUPON_PERFORMANCE } from "@/features/coupons/api"
import type { CouponPerformanceResponse } from "@/features/coupons/types"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"

export function CouponPerformanceCard({ couponId }: { couponId: string }) {
  const t = useTranslations("coupons.performance")
  const { data, loading, error } = useQuery<CouponPerformanceResponse>(
    GET_COUPON_PERFORMANCE,
    { variables: { id: couponId }, fetchPolicy: "cache-and-network" },
  )

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("label")}
          >
            <TrendingUpIcon />
            {t("title")}
          </Button>
        }
      />
      <HoverCardContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUpIcon className="size-4 text-muted-foreground" />
            {t("title")}
          </div>
          {loading && !data ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : error ? (
            <p className="text-xs text-muted-foreground">{t("unavailable")}</p>
          ) : (
            <Stats data={data} />
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function Stats({ data }: { data: CouponPerformanceResponse | undefined }) {
  const t = useTranslations("coupons.performance")
  const perf = data?.couponPerformance?.data
  if (!perf) {
    return (
      <p className="text-xs text-muted-foreground">{t("noRedemptions")}</p>
    )
  }
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <Row label={t("redemptions")} value={perf.times_used.toLocaleString()} />
      <Row
        label={t("discountGiven")}
        value={formatMoneyCents(perf.total_discount_given_cents)}
      />
      <Row
        label={t("revenueAttributed")}
        value={formatMoneyCents(perf.total_revenue_attributed_cents)}
      />
      <Row
        label={t("avgOrderValue")}
        value={formatMoneyCents(perf.avg_order_value_cents)}
      />
      {perf.first_used_at && (
        <Row label={t("firstUsed")} value={formatDate(perf.first_used_at)} />
      )}
      {perf.last_used_at && (
        <Row label={t("lastUsed")} value={formatDate(perf.last_used_at)} />
      )}
    </dl>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between tabular-nums">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
