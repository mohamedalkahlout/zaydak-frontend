import { describe, expect, it } from "vitest"
import {
  adsBaseUrl,
  adsTabFromPath,
  adsTabUrl,
  isAdPlatform,
} from "../routes"

describe("ads routes", () => {
  it("builds tab URLs under marketing/ads", () => {
    expect(adsBaseUrl("acme")).toBe("/store/acme/marketing/ads")
    expect(adsTabUrl("acme", "dashboard")).toBe("/store/acme/marketing/ads")
    expect(adsTabUrl("acme", "campaigns")).toBe(
      "/store/acme/marketing/ads/campaigns",
    )
    expect(adsTabUrl("acme", "integrations")).toBe(
      "/store/acme/marketing/ads/integrations",
    )
    expect(adsTabUrl("acme", "audiences")).toBe(
      "/store/acme/marketing/ads/audiences",
    )
  })

  it("resolves the active tab from the pathname", () => {
    expect(adsTabFromPath("/store/acme/marketing/ads")).toBe("dashboard")
    expect(adsTabFromPath("/store/acme/marketing/ads/")).toBe("dashboard")
    expect(adsTabFromPath("/store/acme/marketing/ads/campaigns")).toBe(
      "campaigns",
    )
    expect(adsTabFromPath("/store/acme/marketing/ads/integrations")).toBe(
      "integrations",
    )
    expect(adsTabFromPath("/store/acme/marketing/ads/audiences")).toBe(
      "audiences",
    )
    expect(adsTabFromPath("/store/acme/marketing/carts")).toBe("dashboard")
  })

  it("narrows platform query values", () => {
    expect(isAdPlatform("google")).toBe(true)
    expect(isAdPlatform("meta")).toBe(true)
    expect(isAdPlatform("nope")).toBe(false)
    expect(isAdPlatform(null)).toBe(false)
  })
})
