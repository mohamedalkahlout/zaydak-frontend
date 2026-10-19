"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { BarChart3Icon, EditIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

/**
 * Sub-navigation under the page header on a saved segment:
 *
 *   ✎ Editor    📊 Insights
 *
 * Only rendered for the edit flow (id route). On `/segments/new` the
 * caller hides this — the segment must be saved before insights make
 * sense.
 */

interface SegmentTabsProps {
  shopSlug: string
  segmentId: string
}

export function SegmentTabs({ shopSlug, segmentId }: SegmentTabsProps) {
  const t = useTranslations("segments.tabs")
  const pathname = usePathname() ?? ""
  const base = `/store/${shopSlug}/segments/${segmentId}`

  const tabs = [
    {
      href: base,
      label: t("editor"),
      icon: EditIcon,
      // Editor page is the bare segment id route — no trailing path.
      isActive: pathname === base,
    },
    {
      href: `${base}/insights`,
      label: t("insights"),
      icon: BarChart3Icon,
      isActive: pathname.startsWith(`${base}/insights`),
    },
  ]

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
              tab.isActive
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
