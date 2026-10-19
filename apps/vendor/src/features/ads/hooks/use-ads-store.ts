"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  addProductSet,
  createDraftCampaign,
  deleteCampaign,
  readAdsState,
  setConnection,
  subscribeAdsState,
  updatePixelId,
} from "../lib/store"
import { demoConnected, emptyConnection } from "../lib/platforms"
import type {
  AdCampaign,
  AdPlatform,
  AdsShopState,
  PlatformConnection,
} from "../types"

const SERVER_SNAPSHOT: AdsShopState = {
  connections: {
    meta: emptyConnection("meta"),
    google: emptyConnection("google"),
    tiktok: emptyConnection("tiktok"),
    snapchat: emptyConnection("snapchat"),
  },
  campaigns: [],
}

/**
 * Shop-scoped ads draft state. Persisted in localStorage until a real ads API
 * exists — Connect / campaigns are scaffolding, not OAuth.
 */
export function useAdsStore(shopSlug: string | null) {
  const slug = shopSlug ?? ""

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!slug) return () => undefined
      return subscribeAdsState(slug, onStoreChange)
    },
    [slug],
  )

  const getSnapshot = useCallback(() => {
    if (!slug) return SERVER_SNAPSHOT
    return readAdsState(slug)
  }, [slug])

  const getServerSnapshot = useCallback(() => SERVER_SNAPSHOT, [])

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const connect = useCallback(
    (platform: AdPlatform) => {
      if (!slug) return
      setConnection(slug, demoConnected(platform))
    },
    [slug],
  )

  const disconnect = useCallback(
    (platform: AdPlatform) => {
      if (!slug) return
      setConnection(slug, emptyConnection(platform))
    },
    [slug],
  )

  const savePixel = useCallback(
    (platform: AdPlatform, pixelId: string) => {
      if (!slug) return
      updatePixelId(slug, platform, pixelId)
    },
    [slug],
  )

  const createCampaign = useCallback(
    (input: { name: string; platform: AdPlatform }): AdCampaign | null => {
      if (!slug) return null
      return createDraftCampaign(slug, input)
    },
    [slug],
  )

  const removeCampaign = useCallback(
    (campaignId: string) => {
      if (!slug) return
      deleteCampaign(slug, campaignId)
    },
    [slug],
  )

  const createProductSet = useCallback(
    (platform: AdPlatform, name: string) => {
      if (!slug) return
      addProductSet(slug, platform, name)
    },
    [slug],
  )

  const connection = useCallback(
    (platform: AdPlatform): PlatformConnection => state.connections[platform],
    [state.connections],
  )

  return {
    state,
    campaigns: state.campaigns,
    connection,
    connect,
    disconnect,
    savePixel,
    createCampaign,
    removeCampaign,
    createProductSet,
  }
}
