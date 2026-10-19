import { describe, expect, it } from "vitest"
import { byGroup, featureState, percentUsed, remaining } from "../entitlements"
import { yearlySavingPercent } from "../billing"
import {
  formatPrice,
  formatQuantity,
  formatReset,
  formatStorage,
  unitLabel,
} from "../format-unit"
import type { EntitlementEntry, PlanEntry, UsageEntry } from "../../types"
import { enTranslator } from "@/shared/test/next-intl"

const plan = (monthly: number, yearly: number): PlanEntry => ({
  id: `p${monthly}`,
  code: "grow",
  name: "Grow",
  monthly_price_cents: monthly,
  yearly_price_cents: yearly,
  currency: "SAR",
  trial_days: 0,
  is_public: true,
  is_active: true,
  sort_order: 0,
})

const entitlement = (over: Partial<EntitlementEntry> = {}): EntitlementEntry => ({
  key: "ai.image.generate",
  group: "ai_images",
  name: "AI image generation",
  kind: "QUOTA",
  billing_unit: "image",
  period: "MONTH",
  enabled: true,
  limit_value: 200,
  config: {},
  source: "PLAN",
  ...over,
})

const usage = (over: Partial<UsageEntry> = {}): UsageEntry => ({
  key: "ai.image.generate",
  billing_unit: "image",
  used: 0,
  limit_value: 200,
  remaining: 200,
  period_start: "2026-08-01T00:00:00.000Z",
  period_end: "2026-09-01T00:00:00.000Z",
  ...over,
})

describe("remaining", () => {
  it("returns null for unlimited, never zero", () => {
    // The distinction the AI Studio already encodes: a caller that reads null
    // as zero hides a feature the shop has unlimited access to.
    expect(remaining(null, 500)).toBeNull()
    expect(remaining(undefined, 500)).toBeNull()
  })

  it("clamps at zero rather than going negative", () => {
    // A shop can end up over its ceiling after a downgrade.
    expect(remaining(200, 210)).toBe(0)
    expect(remaining(200, 200)).toBe(0)
    expect(remaining(200, 30)).toBe(170)
  })
})

describe("percentUsed", () => {
  it("is null for unlimited", () => {
    expect(percentUsed(null, 999)).toBeNull()
  })

  it("treats a zero ceiling as a real ceiling, not unlimited", () => {
    // Returning null here would read as "no limit" to any caller using the null
    // convention, and show plenty of room to a shop allowed nothing.
    expect(percentUsed(0, 5)).toBe(100)
    expect(percentUsed(0, 0)).toBe(0)
  })

  it("caps at 100 for an over-quota shop", () => {
    expect(percentUsed(200, 400)).toBe(100)
  })

  it("keeps one decimal", () => {
    expect(percentUsed(1000, 333)).toBe(33.3)
  })
})

describe("featureState", () => {
  it("folds the entitlement and its usage into one answer", () => {
    const state = featureState("ai.image.generate", [entitlement()], [usage({ used: 130 })])
    expect(state).toMatchObject({
      allowed: true,
      limit: 200,
      used: 130,
      remaining: 70,
      exhausted: false,
      unit: "image",
      period: "MONTH",
    })
    expect(state.resetsAt).toBe("2026-09-01T00:00:00.000Z")
  })

  it("denies a capability absent from the map", () => {
    // A missing entitlement row denies server-side; the UI has to agree or it
    // offers buttons the server refuses.
    expect(featureState("ai.video.generate", [entitlement()], []).allowed).toBe(false)
  })

  it("denies a capability that is present but disabled", () => {
    expect(
      featureState("ai.image.generate", [entitlement({ enabled: false })], []).allowed,
    ).toBe(false)
  })

  it("reports exhausted only when the allowance is actually spent", () => {
    expect(
      featureState("ai.image.generate", [entitlement()], [usage({ used: 200 })]).exhausted,
    ).toBe(true)
    expect(
      featureState("ai.image.generate", [entitlement()], [usage({ used: 199 })]).exhausted,
    ).toBe(false)
  })

  it("never reports an unlimited capability as exhausted", () => {
    const state = featureState(
      "ai.image.generate",
      [entitlement({ limit_value: null })],
      [usage({ used: 9999, limit_value: null })],
    )
    expect(state.remaining).toBeNull()
    expect(state.exhausted).toBe(false)
  })

  it("treats a capability with no usage row as unused, not broken", () => {
    const state = featureState("ai.image.generate", [entitlement()], [])
    expect(state).toMatchObject({ allowed: true, used: 0, remaining: 200 })
  })
})

describe("byGroup", () => {
  it("keeps capabilities in their server-declared groups", () => {
    const groups = byGroup([
      entitlement({ key: "a", group: "ai_images" }),
      entitlement({ key: "b", group: "core" }),
      entitlement({ key: "c", group: "ai_images" }),
    ])
    expect(groups.map(([g, caps]) => [g, caps.length])).toEqual([
      ["ai_images", 2],
      ["core", 1],
    ])
  })
})

describe("yearlySavingPercent", () => {
  it("reports the saving a yearly price actually buys", () => {
    // 29900 x 12 = 358800; a 299000 yearly price saves 16%.
    expect(yearlySavingPercent([plan(29900, 299000)])).toBe(16)
  })

  it("takes the lowest saving, not the best one", () => {
    // The badge sits on one switch that applies to every plan, so it has to be
    // true for whichever plan the vendor then clicks.
    expect(yearlySavingPercent([plan(29900, 299000), plan(10000, 114000)])).toBe(5)
  })

  it("returns null when any plan's yearly price is not a discount", () => {
    expect(yearlySavingPercent([plan(29900, 299000), plan(10000, 120000)])).toBeNull()
    expect(yearlySavingPercent([plan(10000, 130000)])).toBeNull()
  })

  it("skips plans priced for only one interval rather than counting them as zero", () => {
    // A monthly-only tier is not a plan that saves nothing yearly — letting it
    // collapse the badge would hide a real discount on every other tier.
    expect(yearlySavingPercent([plan(29900, 0), plan(29900, 299000)])).toBe(16)
    expect(yearlySavingPercent([plan(0, 0)])).toBeNull()
    expect(yearlySavingPercent([])).toBeNull()
  })
})

describe("format-unit", () => {
  it("reads storage back in the unit the plan was sold in", () => {
    // A plan sold as "50 GB" must not display as "51200".
    expect(formatStorage(51200)).toBe("50 GB")
    expect(formatStorage(1024)).toBe("1 GB")
    expect(formatStorage(1536)).toBe("1.5 GB")
    expect(formatStorage(512)).toBe("512 MB")
  })

  it("drops the decimal above 10 GB, where it is noise", () => {
    expect(formatStorage(204800)).toBe("200 GB")
  })

  it("groups plain counts", () => {
    expect(formatQuantity(1000, "image")).toBe("1,000")
    expect(formatQuantity(48210, "character")).toBe("48,210")
  })

  it("routes megabytes through the storage formatter", () => {
    expect(formatQuantity(51200, "megabyte")).toBe("50 GB")
  })

  it("gives storage no unit label — the number already carries GB/MB", () => {
    const t = enTranslator("plan")
    expect(unitLabel("megabyte", 50, t)).toBe("")
    expect(unitLabel("none", 1, t)).toBe("")
    expect(unitLabel("image", 1, t)).toBe("image")
    expect(unitLabel("image", 2, t)).toBe("images")
  })

  it("keeps a unit the catalogue does not know readable", () => {
    const t = enTranslator("plan")
    expect(unitLabel("widget", 1, t)).toBe("widget")
    expect(unitLabel("widget", 3, t)).toBe("widgets")
  })

  it("formats a reset date, and survives a bad one", () => {
    expect(formatReset("2026-09-01T00:00:00.000Z")).toMatch(/Sep/)
    expect(formatReset(null)).toBeNull()
    expect(formatReset("not a date")).toBeNull()
  })

  it("converts cents once, at the boundary", () => {
    expect(formatPrice(29900, "SAR", "en")).toContain("299")
    // A whole-riyal price shows no decimals; a fractional one does.
    expect(formatPrice(29900, "SAR", "en")).not.toContain(".00")
    expect(formatPrice(29950, "SAR", "en")).toContain(".5")
  })
})
