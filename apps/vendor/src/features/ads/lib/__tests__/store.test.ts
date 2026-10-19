import { describe, expect, it, beforeEach } from "vitest"
import {
  clearAdsStateCache,
  createDraftCampaign,
  deleteCampaign,
  readAdsState,
  setConnection,
  writeAdsState,
} from "../store"
import { demoConnected, emptyConnection } from "../platforms"

describe("ads local store", () => {
  const shop = "test-shop"

  beforeEach(() => {
    window.localStorage.clear()
    clearAdsStateCache()
    writeAdsState(shop, {
      connections: {
        meta: emptyConnection("meta"),
        google: emptyConnection("google"),
        tiktok: emptyConnection("tiktok"),
        snapchat: emptyConnection("snapchat"),
      },
      campaigns: [],
    })
  })

  it("creates and deletes draft campaigns", () => {
    const campaign = createDraftCampaign(shop, {
      name: "Summer",
      platform: "meta",
    })
    expect(campaign.status).toBe("draft")
    expect(readAdsState(shop).campaigns).toHaveLength(1)

    deleteCampaign(shop, campaign.id)
    expect(readAdsState(shop).campaigns).toHaveLength(0)
  })

  it("stores a demo connection per platform", () => {
    setConnection(shop, demoConnected("snapchat"))
    const snap = readAdsState(shop).connections.snapchat
    expect(snap.connected).toBe(true)
    expect(snap.accounts.length).toBeGreaterThan(0)
  })

  it("returns a referentially stable snapshot between unchanged reads", () => {
    const first = readAdsState(shop)
    const second = readAdsState(shop)
    expect(second).toBe(first)
  })

  it("returns a new snapshot after a write", () => {
    const before = readAdsState(shop)
    createDraftCampaign(shop, { name: "Stability", platform: "google" })
    const after = readAdsState(shop)
    expect(after).not.toBe(before)
    expect(after.campaigns).toHaveLength(1)
    expect(readAdsState(shop)).toBe(after)
  })
})
