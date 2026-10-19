import { emptyConnection } from "./platforms"
import type {
  AdCampaign,
  AdPlatform,
  AdsShopState,
  PlatformConnection,
} from "../types"
import { AD_PLATFORMS } from "./routes"

const STORAGE_PREFIX = "zaydak:ads:v1:"

/** Parsed snapshot keyed by shop — required for useSyncExternalStore getSnapshot. */
type CacheEntry = { raw: string | null; state: AdsShopState }
const snapshotCache = new Map<string, CacheEntry>()

function emptyState(): AdsShopState {
  const connections = {} as Record<AdPlatform, PlatformConnection>
  for (const platform of AD_PLATFORMS) {
    connections[platform] = emptyConnection(platform)
  }
  return { connections, campaigns: [] }
}

function storageKey(shopSlug: string): string {
  return `${STORAGE_PREFIX}${shopSlug}`
}

function parseState(raw: string | null): AdsShopState {
  if (!raw) return emptyState()
  try {
    const parsed = JSON.parse(raw) as Partial<AdsShopState>
    const base = emptyState()
    if (parsed.connections) {
      for (const platform of AD_PLATFORMS) {
        const row = parsed.connections[platform]
        if (row && typeof row === "object") {
          base.connections[platform] = { ...base.connections[platform], ...row }
        }
      }
    }
    if (Array.isArray(parsed.campaigns)) {
      base.campaigns = parsed.campaigns.filter(
        (c): c is AdCampaign =>
          !!c &&
          typeof c === "object" &&
          typeof c.id === "string" &&
          typeof c.name === "string",
      )
    }
    return base
  } catch {
    return emptyState()
  }
}

/**
 * Shop ads state. Returns the same object reference until the underlying
 * localStorage value changes — `useSyncExternalStore` requires that.
 */
export function readAdsState(shopSlug: string): AdsShopState {
  if (typeof window === "undefined") return emptyState()
  const raw = window.localStorage.getItem(storageKey(shopSlug))
  const hit = snapshotCache.get(shopSlug)
  if (hit && hit.raw === raw) return hit.state
  const state = parseState(raw)
  snapshotCache.set(shopSlug, { raw, state })
  return state
}

export function writeAdsState(shopSlug: string, state: AdsShopState): void {
  if (typeof window === "undefined") return
  const raw = JSON.stringify(state)
  window.localStorage.setItem(storageKey(shopSlug), raw)
  snapshotCache.set(shopSlug, { raw, state })
  window.dispatchEvent(
    new CustomEvent("zaydak:ads-changed", { detail: { shopSlug } }),
  )
}

/** Drop cached snapshots (tests / after external localStorage clears). */
export function clearAdsStateCache(): void {
  snapshotCache.clear()
}

export function subscribeAdsState(
  shopSlug: string,
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined

  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(shopSlug)) return
    // Other tab wrote localStorage — drop cache so getSnapshot re-parses.
    snapshotCache.delete(shopSlug)
    onStoreChange()
  }
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ shopSlug: string }>).detail
    if (detail?.shopSlug === shopSlug) onStoreChange()
  }

  window.addEventListener("storage", onStorage)
  window.addEventListener("zaydak:ads-changed", onCustom)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener("zaydak:ads-changed", onCustom)
  }
}

export function createDraftCampaign(
  shopSlug: string,
  input: { name: string; platform: AdPlatform },
): AdCampaign {
  const state = readAdsState(shopSlug)
  const campaign: AdCampaign = {
    id: `camp_${Date.now().toString(36)}`,
    name: input.name.trim() || "Untitled campaign",
    platform: input.platform,
    status: "draft",
    objective: "sales",
    start_date: null,
    end_date: null,
    created_at: new Date().toISOString(),
  }
  writeAdsState(shopSlug, {
    ...state,
    campaigns: [campaign, ...state.campaigns],
  })
  return campaign
}

export function deleteCampaign(shopSlug: string, campaignId: string): void {
  const state = readAdsState(shopSlug)
  writeAdsState(shopSlug, {
    ...state,
    campaigns: state.campaigns.filter((c) => c.id !== campaignId),
  })
}

export function setConnection(
  shopSlug: string,
  connection: PlatformConnection,
): void {
  const state = readAdsState(shopSlug)
  writeAdsState(shopSlug, {
    ...state,
    connections: {
      ...state.connections,
      [connection.platform]: connection,
    },
  })
}

export function updatePixelId(
  shopSlug: string,
  platform: AdPlatform,
  pixelId: string,
): void {
  const state = readAdsState(shopSlug)
  const current = state.connections[platform]
  writeAdsState(shopSlug, {
    ...state,
    connections: {
      ...state.connections,
      [platform]: {
        ...current,
        pixel_id: pixelId,
        pixel_active: pixelId.trim().length > 0,
      },
    },
  })
}

export function addProductSet(
  shopSlug: string,
  platform: AdPlatform,
  name: string,
): void {
  const state = readAdsState(shopSlug)
  const current = state.connections[platform]
  const set = {
    id: `ps_${Date.now().toString(36)}`,
    name: name.trim() || "Product set",
  }
  writeAdsState(shopSlug, {
    ...state,
    connections: {
      ...state.connections,
      [platform]: {
        ...current,
        product_sets: [...current.product_sets, set],
      },
    },
  })
}
