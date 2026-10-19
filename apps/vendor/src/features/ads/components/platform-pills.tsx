"use client"

import { useTranslations } from "next-intl"
import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import type { AdPlatform } from "../types"
import { AD_PLATFORMS } from "../lib/routes"
import { PlatformIcon } from "./platform-icon"

export function PlatformPills({
  value,
  onChange,
  className,
}: {
  value: AdPlatform
  onChange: (platform: AdPlatform) => void
  className?: string
}) {
  const t = useTranslations("ads.platforms")

  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {AD_PLATFORMS.map((platform) => {
        const active = value === platform
        return (
          <Button
            key={platform}
            type="button"
            role="tab"
            aria-selected={active}
            variant={active ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-9 gap-2 rounded-full px-3",
              active && "ring-1 ring-foreground/15",
            )}
            onClick={() => onChange(platform)}
          >
            <PlatformIcon platform={platform} className="size-5 text-[9px]" />
            {t(platform)}
          </Button>
        )
      })}
    </div>
  )
}
