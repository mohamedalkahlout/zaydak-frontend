"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { MegaphoneIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Badge } from "@repo/ui/components/badge"
import { useAdsStore } from "../hooks/use-ads-store"
import { adsTabUrl } from "../lib/routes"
import type { AdPlatform } from "../types"
import { PlatformIcon } from "./platform-icon"
import { PlatformPills } from "./platform-pills"
import { CreateAdDialog } from "./create-ad-dialog"

type RangeKey = "last_7_days" | "last_30_days" | "last_90_days"

/**
 * Marketing ads dashboard shell: platform filter, zero KPIs, empty chart, and
 * latest local draft campaigns. No live ad-platform metrics yet.
 */
export function AdsDashboard() {
  const t = useTranslations("ads")
  const locale = useLocale()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const { campaigns, createCampaign } = useAdsStore(shopSlug)
  const [platform, setPlatform] = useState<AdPlatform>("meta")
  const [range, setRange] = useState<RangeKey>("last_7_days")

  const filtered = useMemo(
    () => campaigns.filter((c) => c.platform === platform),
    [campaigns, platform],
  )
  const latest = filtered.slice(0, 5)

  const kpis = [
    { key: "impressions", value: "0" },
    { key: "avgCpc", value: "—" },
    { key: "clicks", value: "0" },
    { key: "spend", value: "—" },
  ] as const

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PlatformPills value={platform} onChange={setPlatform} />
        <Select
          value={range}
          onValueChange={(v) => {
            if (v) setRange(v as RangeKey)
          }}
        >
          <SelectTrigger className="h-9 w-[11.5rem]">
            <SelectValue>
              {(value: RangeKey | null) =>
                value ? t(`range.${value}`) : ""
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_7_days">{t("range.last_7_days")}</SelectItem>
            <SelectItem value="last_30_days">{t("range.last_30_days")}</SelectItem>
            <SelectItem value="last_90_days">{t("range.last_90_days")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.key} size="sm" className="gap-2">
            <CardHeader className="pb-0">
              <CardDescription className="text-xs">
                {t(`kpi.${kpi.key}`)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {kpi.value}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("chart.title")}</CardTitle>
          <CardDescription>{t("chart.emptyHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
            <p className="max-w-sm px-4 text-center text-sm text-muted-foreground">
              {t("chart.empty")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">{t("latest.title")}</CardTitle>
            <CardDescription>{t("latest.subtitle")}</CardDescription>
          </div>
          {shopSlug ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={adsTabUrl(shopSlug, "campaigns")} />}
            >
              {t("latest.viewAll")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {latest.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MegaphoneIcon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("latest.emptyTitle")}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("latest.emptyBody")}
                </p>
              </div>
              <CreateAdDialog
                defaultPlatform={platform}
                onCreate={(input) => createCampaign(input)}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {latest.map((campaign) => (
                <li
                  key={campaign.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <PlatformIcon platform={campaign.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`objective.${campaign.objective}`)} ·{" "}
                      {new Date(campaign.created_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {t(`status.${campaign.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
