"use client"

import { useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"

/**
 * Shown for every settings section other than General. Keeps the two-pane
 * layout intact while signalling the area isn't wired up yet.
 */
export function SectionPlaceholder({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  const t = useTranslations("settings")
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("comingSoon")}
      </p>
    </div>
  )
}
