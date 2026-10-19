"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from "@repo/ui/components/badge"

/**
 * This page's own top bar, because it has no dashboard header above it.
 *
 * It carries exactly two things: the way back, and what the store is on right
 * now. The second is here rather than only in the section below because it is
 * the fact every price on this page is relative to — scrolling four tiers deep
 * and forgetting where you started is how a vendor "upgrades" to the plan they
 * already have.
 */
export function PlanPageHeader({
  backHref,
  planName,
  badge,
}: {
  backHref: string
  planName: string
  badge?: string | null
}) {
  const t = useTranslations("plan")

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          <span className="hidden sm:inline">{t("backToStore")}</span>
        </Link>

        <div className="ms-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("yourPlan")}</span>
          <span className="text-sm font-medium">{planName}</span>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
      </div>
    </header>
  )
}
