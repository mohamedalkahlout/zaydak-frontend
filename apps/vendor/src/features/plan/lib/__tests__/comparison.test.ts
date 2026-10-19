import { describe, expect, it } from "vitest"
import {
  buildMatrix,
  cellFor,
  groupCatalog,
  highlightsFor,
  isEmptyRow,
} from "../comparison"
import { monthlyEquivalentCents } from "../billing"
import type {
  CapabilityEntry,
  PlanCapabilityEntry,
  PlanEntry,
} from "../../types"

const capability = (over: Partial<CapabilityEntry> = {}): CapabilityEntry => ({
  key: "ai.image.generate",
  group: "ai_images",
  name: "AI image generation",
  kind: "QUOTA",
  billing_unit: "image",
  period: "MONTH",
  sort_order: 0,
  ...over,
})

const granted = (
  over: Partial<PlanCapabilityEntry> = {},
): PlanCapabilityEntry => ({
  feature_key: "ai.image.generate",
  enabled: true,
  limit_value: 200,
  ...over,
})

describe("cellFor", () => {
  it("treats a capability absent from the plan as excluded, not unlimited", () => {
    expect(cellFor(capability(), undefined)).toEqual({ kind: "excluded" })
  })

  it("treats a disabled row as excluded even when it carries a limit", () => {
    expect(cellFor(capability(), granted({ enabled: false }))).toEqual({
      kind: "excluded",
    })
  })

  it("reads a null limit as unlimited", () => {
    expect(cellFor(capability(), granted({ limit_value: null }))).toEqual({
      kind: "unlimited",
    })
  })

  it("keeps a zero ceiling distinct from an excluded capability", () => {
    expect(cellFor(capability(), granted({ limit_value: 0 }))).toEqual({
      kind: "amount",
      value: 0,
    })
  })

  it("renders a BOOLEAN as included, ignoring any limit on the row", () => {
    expect(
      cellFor(capability({ kind: "BOOLEAN" }), granted({ limit_value: 5 })),
    ).toEqual({ kind: "included" })
  })
})

describe("isEmptyRow", () => {
  it("is true only when every tier excludes the capability", () => {
    expect(isEmptyRow([{ kind: "excluded" }, { kind: "excluded" }])).toBe(true)
    expect(isEmptyRow([{ kind: "excluded" }, { kind: "amount", value: 0 }])).toBe(
      false,
    )
  })
})

describe("groupCatalog", () => {
  it("keeps the server's order rather than sorting the groups", () => {
    const groups = groupCatalog([
      capability({ key: "a", group: "storage" }),
      capability({ key: "b", group: "ai_images" }),
      capability({ key: "c", group: "storage" }),
    ])

    expect(groups.map((g) => g.group)).toEqual(["storage", "ai_images"])
    expect(groups[0]!.capabilities.map((c) => c.key)).toEqual(["a", "c"])
  })
})

describe("buildMatrix", () => {
  it("indexes each plan's rows by feature key", () => {
    const matrix = buildMatrix([
      { plan_id: "p1", capabilities: [granted()] },
      { plan_id: "p2", capabilities: [] },
    ])

    expect(matrix.get("p1")?.get("ai.image.generate")?.limit_value).toBe(200)
    expect(matrix.get("p2")?.size).toBe(0)
  })
})

describe("highlightsFor", () => {
  const catalog = [
    capability({ key: "images", kind: "QUOTA" }),
    capability({ key: "staff", kind: "LIMIT", billing_unit: "none" }),
    capability({ key: "b2b", kind: "BOOLEAN", billing_unit: "none" }),
  ]

  const planMap = (rows: PlanCapabilityEntry[]) =>
    new Map(rows.map((r) => [r.feature_key, r]))

  it("lists what the cheapest tier grants when there is nothing to compare to", () => {
    const rows = planMap([
      granted({ feature_key: "images", limit_value: 100 }),
      granted({ feature_key: "staff", enabled: false }),
      granted({ feature_key: "b2b", limit_value: null }),
    ])

    expect(highlightsFor(catalog, rows, undefined).map((h) => h.capability.key))
      .toEqual(["images", "b2b"])
  })

  it("lists only the upgrades over the tier below it", () => {
    const previous = planMap([
      granted({ feature_key: "images", limit_value: 100 }),
      granted({ feature_key: "b2b", limit_value: null }),
    ])
    const rows = planMap([
      granted({ feature_key: "images", limit_value: 500 }),
      granted({ feature_key: "staff", limit_value: 5 }),
      granted({ feature_key: "b2b", limit_value: null }),
    ])

    // images grew, staff is new, b2b is identical — so b2b is left out.
    expect(highlightsFor(catalog, rows, previous).map((h) => h.capability.key))
      .toEqual(["images", "staff"])
  })

  it("counts a move to unlimited as an upgrade", () => {
    const previous = planMap([granted({ feature_key: "images", limit_value: 500 })])
    const rows = planMap([granted({ feature_key: "images", limit_value: null })])

    expect(highlightsFor(catalog, rows, previous)).toHaveLength(1)
  })

  it("stops at the limit so a card cannot grow the whole catalog", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      capability({ key: `k${i}`, kind: "BOOLEAN", billing_unit: "none" }),
    )
    const rows = planMap(
      many.map((c) => granted({ feature_key: c.key, limit_value: null })),
    )

    expect(highlightsFor(many, rows, undefined, 3)).toHaveLength(3)
  })
})

describe("monthlyEquivalentCents", () => {
  const plan = (yearly: number): PlanEntry => ({
    id: "p",
    code: "grow",
    name: "Grow",
    monthly_price_cents: 7200,
    yearly_price_cents: yearly,
    currency: "SAR",
    trial_days: 0,
    is_public: true,
    is_active: true,
    sort_order: 0,
  })

  it("rounds up, so twelve months never quote less than the yearly charge", () => {
    // 64800 / 12 is exact; 64801 must not read as the same monthly figure.
    expect(monthlyEquivalentCents(plan(64800))).toBe(5400)
    expect(monthlyEquivalentCents(plan(64801))).toBe(5401)
  })
})
