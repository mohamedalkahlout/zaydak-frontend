export type AdPlatform = "meta" | "google" | "tiktok" | "snapchat"

export type CampaignStatus = "draft" | "active" | "paused" | "ended"

export type CampaignObjective = "sales" | "traffic" | "awareness"

export interface AdCampaign {
  id: string
  name: string
  platform: AdPlatform
  status: CampaignStatus
  objective: CampaignObjective
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface ConnectedAccount {
  id: string
  name: string
}

export interface ProductSet {
  id: string
  name: string
}

export interface PlatformConnection {
  platform: AdPlatform
  connected: boolean
  pixel_id: string | null
  pixel_active: boolean
  /** Google Merchant Center / TikTok catalog / Snapchat catalog feed. */
  catalog_linked: boolean
  accounts: ConnectedAccount[]
  catalog_synced: number
  catalog_total: number
  last_sync_at: string | null
  product_sets: ProductSet[]
}

export interface AdsShopState {
  connections: Record<AdPlatform, PlatformConnection>
  campaigns: AdCampaign[]
}

export type AdsTab = "dashboard" | "campaigns" | "integrations" | "audiences"
