"use client"

import { cn } from "@repo/ui/lib/utils"
import type { AdPlatform } from "../types"
import { PLATFORM_COLORS } from "../lib/platforms"

/** Compact brand mark for list rows and pills — letter mark, not trademark art. */
export function PlatformIcon({
  platform,
  className,
}: {
  platform: AdPlatform
  className?: string
}) {
  const label =
    platform === "meta"
      ? "Meta"
      : platform === "google"
        ? "G"
        : platform === "tiktok"
          ? "Tk"
          : "Sc"

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        platform === "snapchat" ? "text-zinc-900" : "text-white",
        className,
      )}
      style={{ backgroundColor: PLATFORM_COLORS[platform] }}
    >
      {label === "Meta" ? "f" : label}
    </span>
  )
}
