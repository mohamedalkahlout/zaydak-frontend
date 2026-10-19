import type { AdPlatform, PlatformConnection } from "../types"

/** Brand colours for chips and list icons — concrete hex for SVG-safe use. */
export const PLATFORM_COLORS: Record<AdPlatform, string> = {
  meta: "#1877F2",
  google: "#4285F4",
  tiktok: "#010101",
  snapchat: "#FFFC00",
}

export function emptyConnection(platform: AdPlatform): PlatformConnection {
  return {
    platform,
    connected: false,
    pixel_id: null,
    pixel_active: false,
    catalog_linked: false,
    accounts: [],
    catalog_synced: 0,
    catalog_total: 0,
    last_sync_at: null,
    product_sets: [],
  }
}

/** Demo payload after a local "Connect" — not a real OAuth result. */
export function demoConnected(platform: AdPlatform): PlatformConnection {
  const base = emptyConnection(platform)
  switch (platform) {
    case "google":
      return {
        ...base,
        connected: true,
        pixel_id: "AW-••••••••••1234",
        pixel_active: true,
        catalog_linked: true,
      }
    case "tiktok":
      return {
        ...base,
        connected: true,
        pixel_id: "C••••••••••5678",
        pixel_active: true,
        catalog_linked: true,
      }
    case "snapchat":
      return {
        ...base,
        connected: true,
        pixel_id: "",
        pixel_active: false,
        catalog_linked: true,
        accounts: [{ id: "snap-1", name: "Store Ads Account" }],
        catalog_synced: 0,
        catalog_total: 0,
        last_sync_at: null,
        product_sets: [],
      }
    case "meta":
      return {
        ...base,
        connected: true,
        pixel_id: "••••••••••9012",
        pixel_active: true,
        catalog_linked: true,
      }
  }
}
