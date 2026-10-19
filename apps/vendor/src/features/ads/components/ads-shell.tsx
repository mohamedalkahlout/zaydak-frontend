"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { cn } from "@repo/ui/lib/utils"
import { ADS_TABS, adsTabFromPath, adsTabUrl } from "../lib/routes"
import { useAdsStore } from "../hooks/use-ads-store"
import { CreateAdDialog } from "./create-ad-dialog"
import type { AdPlatform } from "../types"

/**
 * Shared chrome for the four Marketing → Ads routes: sub-nav + Create Ad.
 * Campaign drafts live in localStorage until a real ads API ships.
 */
export function AdsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("ads")
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const tab = adsTabFromPath(pathname ?? "")
  const { createCampaign } = useAdsStore(shopSlug)

  const onCreate = (input: { name: string; platform: AdPlatform }) => {
    const campaign = createCampaign(input)
    if (!campaign || !shopSlug) return
    sileo.success({ title: t("toasts.draftCreated") })
    router.push(`${adsTabUrl(shopSlug, "campaigns")}?id=${campaign.id}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateAdDialog onCreate={onCreate} />
      </div>

      <nav
        aria-label={t("sectionsLabel")}
        className="border-b border-border"
      >
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {ADS_TABS.map((value) => {
            const active = tab === value
            return (
              <Link
                key={value}
                href={shopSlug ? adsTabUrl(shopSlug, value) : "#"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`tab.${value}`)}
              </Link>
            )
          })}
        </div>
      </nav>

      {children}
    </div>
  )
}
