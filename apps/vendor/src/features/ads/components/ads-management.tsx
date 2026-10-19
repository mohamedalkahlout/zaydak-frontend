"use client"

import { useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"
import { MegaphoneIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { cn } from "@repo/ui/lib/utils"
import { useAdsStore } from "../hooks/use-ads-store"
import { CreateAdDialog } from "./create-ad-dialog"
import { PlatformIcon } from "./platform-icon"

/**
 * Split-pane campaign list + detail. Drafts are local until launch / OAuth
 * exist; Edit is a placeholder toast, Delete removes the local row.
 */
export function AdsManagement() {
  const t = useTranslations("ads")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const { campaigns, createCampaign, removeCampaign } = useAdsStore(shopSlug)

  const selectedId = searchParams.get("id")
  const selected = useMemo(() => {
    if (campaigns.length === 0) return null
    return campaigns.find((c) => c.id === selectedId) ?? campaigns[0] ?? null
  }, [campaigns, selectedId])

  const selectCampaign = (id: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("id", id)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const onDelete = () => {
    if (!selected) return
    removeCampaign(selected.id)
    sileo.success({ title: t("toasts.draftDeleted") })
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MegaphoneIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("management.emptyTitle")}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("management.emptyBody")}
            </p>
          </div>
          <CreateAdDialog onCreate={(input) => createCampaign(input)} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-sm font-medium">
            {t("management.listTitle")}
          </CardTitle>
          <CardDescription>
            {t("management.listCount", { count: campaigns.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {campaigns.map((campaign) => {
              const active = selected?.id === campaign.id
              return (
                <li key={campaign.id}>
                  <button
                    type="button"
                    onClick={() => selectCampaign(campaign.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors",
                      active ? "bg-muted/60" : "hover:bg-muted/40",
                    )}
                  >
                    <PlatformIcon platform={campaign.platform} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {campaign.name}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {t(`status.${campaign.status}`)}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(`platforms.${campaign.platform}`)} ·{" "}
                        {t(`objective.${campaign.objective}`)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={selected.platform} />
                <CardTitle className="truncate text-lg">
                  {selected.name}
                </CardTitle>
              </div>
              <CardDescription className="mt-1">
                {t(`platforms.${selected.platform}`)} ·{" "}
                {t(`objective.${selected.objective}`)} ·{" "}
                {t("management.created", {
                  date: new Date(selected.created_at).toLocaleDateString(locale),
                })}
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => sileo.info({ title: t("toasts.editSoon") })}
              >
                <PencilIcon className="size-3.5" />
                {t("management.edit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive"
                onClick={onDelete}
              >
                <Trash2Icon className="size-3.5" />
                {t("management.delete")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.status === "draft" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-medium">{t("management.draftBannerTitle")}</p>
                <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                  {t("management.draftBannerBody")}
                </p>
              </div>
            ) : null}

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <dt className="text-xs text-muted-foreground">
                  {t("management.fields.status")}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {t(`status.${selected.status}`)}
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <dt className="text-xs text-muted-foreground">
                  {t("management.fields.dates")}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {selected.start_date && selected.end_date
                    ? `${selected.start_date} → ${selected.end_date}`
                    : t("management.fields.noDates")}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
