import type { AdPlatform, AdsTab } from "../types"

export const AD_PLATFORMS: AdPlatform[] = [
  "tiktok",
  "snapchat",
  "google",
  "meta",
]

export const ADS_TABS: AdsTab[] = [
  "dashboard",
  "campaigns",
  "integrations",
  "audiences",
]

export function adsBaseUrl(shopSlug: string): string {
  return `/store/${shopSlug}/marketing/ads`
}

export function adsTabUrl(shopSlug: string, tab: AdsTab): string {
  const base = adsBaseUrl(shopSlug)
  switch (tab) {
    case "dashboard":
      return base
    case "campaigns":
      return `${base}/campaigns`
    case "integrations":
      return `${base}/integrations`
    case "audiences":
      return `${base}/audiences`
  }
}

/**
 * Which ads tab a pathname is on. Matched on the segment after `/marketing/ads`
 * so `/marketing/ads` does not light up every tab.
 */
export function adsTabFromPath(pathname: string): AdsTab {
  const parts = pathname.split("/").filter(Boolean)
  // store / slug / marketing / ads / [tab?]
  const adsIdx = parts.indexOf("ads")
  if (adsIdx < 0) return "dashboard"
  const segment = parts[adsIdx + 1]
  if (segment === "campaigns") return "campaigns"
  if (segment === "integrations") return "integrations"
  if (segment === "audiences") return "audiences"
  return "dashboard"
}

export function isAdPlatform(value: string | null | undefined): value is AdPlatform {
  return (
    value === "meta" ||
    value === "google" ||
    value === "tiktok" ||
    value === "snapchat"
  )
}
