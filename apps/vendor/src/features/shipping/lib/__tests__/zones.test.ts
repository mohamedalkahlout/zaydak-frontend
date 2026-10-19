import { describe, expect, it } from "vitest"

import {
  diagnose,
  effectiveRate,
  isCatchAll,
  orderZones,
  otherCatchAll,
  rateColumns,
  rateFields,
  shadowedRates,
  textOf,
} from "../zones"
import type { ShippingRule, ShippingZone } from "../../types"

function rule(partial: Partial<ShippingRule> & { id: string }): ShippingRule {
  return {
    name: { en: partial.id },
    type: "fixed",
    amount_cents: 1500,
    amount_bps: 0,
    per_kg_cents: 0,
    min_order_cents: 0,
    zone_id: null,
    is_global: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

function zone(
  partial: Partial<ShippingZone> & { id: string; name: ShippingZone["name"] },
): ShippingZone {
  return {
    countries: [],
    states: [],
    priority: 0,
    is_global: false,
    shop_id: "shop_1",
    rules: [],
    ...partial,
  }
}

describe("textOf", () => {
  it("prefers English, falls back to Arabic", () => {
    expect(textOf({ en: "Gulf", ar: "الخليج" })).toBe("Gulf")
    expect(textOf({ en: "", ar: "الخليج" })).toBe("الخليج")
    expect(textOf(null)).toBe("")
  })
})

describe("isCatchAll", () => {
  it("treats an empty country list as the catch-all", () => {
    expect(isCatchAll({ countries: [] })).toBe(true)
    expect(isCatchAll({ countries: ["SA"] })).toBe(false)
  })
})

describe("effectiveRate", () => {
  it("picks the newest rate, not the first in the array", () => {
    // The back-end orders by created_at desc and takes [0]; the API may return
    // them in any order, so reading rules[0] here would name the wrong winner.
    const z = zone({
      id: "z1",
      name: { en: "Gulf" },
      rules: [
        rule({ id: "old", created_at: "2026-01-01T00:00:00.000Z" }),
        rule({ id: "new", created_at: "2026-06-01T00:00:00.000Z" }),
      ],
    })
    expect(effectiveRate(z)?.id).toBe("new")
  })

  it("returns null for a zone with no rates", () => {
    expect(effectiveRate(zone({ id: "z1", name: { en: "Gulf" } }))).toBeNull()
  })
})

describe("shadowedRates", () => {
  it("names every rate that will never be charged", () => {
    const z = zone({
      id: "z1",
      name: { en: "Gulf" },
      rules: [
        rule({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
        rule({ id: "b", created_at: "2026-06-01T00:00:00.000Z" }),
        rule({ id: "c", created_at: "2026-03-01T00:00:00.000Z" }),
      ],
    })
    expect(shadowedRates(z).map((r) => r.id).sort()).toEqual(["a", "c"])
  })

  it("is empty when a zone carries one rate", () => {
    const z = zone({ id: "z1", name: { en: "Gulf" }, rules: [rule({ id: "a" })] })
    expect(shadowedRates(z)).toEqual([])
  })
})

describe("diagnose", () => {
  const catchAll = zone({
    id: "z0",
    name: { en: "Rest of world" },
    rules: [rule({ id: "r0" })],
  })

  it("flags a shop with nothing configured — the state that broke checkout", () => {
    expect(diagnose([], [])).toEqual([
      { id: "nothingConfigured", severity: "error" },
    ])
  })

  it("says nothing when an unzoned rate is the only configuration", () => {
    // With no zones the legacy rule applies everywhere, so it is correct.
    expect(diagnose([], [rule({ id: "r1" })])).toEqual([])
  })

  // The pane told a carrier-only merchant in red that no shipping was
  // configured, under a working carrier list, with no zone they could add that
  // would silence it. Every warning here is about the shop's OWN delivery.
  it("says nothing about zones for a shop delivering by carrier", () => {
    expect(
      diagnose([], [], {
        offersMerchantDelivery: false,
        offersCarrierDelivery: true,
      }),
    ).toEqual([])
  })

  it("stays quiet about the shop's own zones once that channel is off", () => {
    // The rates are kept on file so a merchant pausing the channel does not
    // lose them — which is why they are still here to be misread.
    const gulf = zone({
      id: "z1",
      name: { en: "Gulf" },
      countries: ["SA", "AE"],
      rules: [rule({ id: "r1" }), rule({ id: "r2" })],
    })
    expect(diagnose([gulf], [], { offersMerchantDelivery: false })).toEqual([])
  })

  it("still flags a shop offering neither channel", () => {
    // Both off with nothing configured is a shop that cannot deliver at all.
    // Legitimate for downloads only, and worth saying out loud otherwise.
    expect(
      diagnose([], [], {
        offersMerchantDelivery: true,
        offersCarrierDelivery: false,
      }),
    ).toEqual([{ id: "nothingConfigured", severity: "error" }])
  })

  it("flags unzoned rates the moment a zone exists", () => {
    const found = diagnose([catchAll], [rule({ id: "r1" }), rule({ id: "r2" })])
    expect(found).toContainEqual({
      id: "unzonedShadowed",
      severity: "warning",
      count: 2,
    })
  })

  it("flags zones with no catch-all as an error", () => {
    const gulf = zone({
      id: "z1",
      name: { en: "Gulf" },
      countries: ["SA", "AE"],
      rules: [rule({ id: "r1" })],
    })
    expect(diagnose([gulf], [])).toContainEqual({
      id: "noCatchAll",
      severity: "error",
    })
  })

  it("does not flag a missing catch-all for a shop that only delivers at home", () => {
    const gaza = zone({
      id: "z1",
      name: { en: "Gaza" },
      countries: ["PS"],
      rules: [rule({ id: "r1" })],
    })
    const found = diagnose([gaza], [], {}, { domesticOnly: true })
    expect(found.some((d) => d.id === "noCatchAll")).toBe(false)
  })

  it("does not flag a missing catch-all when one exists", () => {
    const found = diagnose([catchAll], [])
    expect(found.some((d) => d.id === "noCatchAll")).toBe(false)
  })

  // Two catch-alls match exactly the same destinations, so one of them is
  // never charged while it sits on the list looking live. The dialog refuses
  // to create a second, so this only reaches rows that predate the guard or
  // came through the API.
  it("flags two catch-all zones by name as a warning", () => {
    const second = zone({
      id: "z9",
      name: { en: "Everywhere" },
      rules: [rule({ id: "r9" })],
    })
    expect(diagnose([catchAll, second], [])).toContainEqual({
      id: "multipleCatchAlls",
      severity: "warning",
      zones: ["Rest of world", "Everywhere"],
    })
  })

  it("does not flag a single catch-all", () => {
    const found = diagnose([catchAll], [])
    expect(found.some((d) => d.id === "multipleCatchAlls")).toBe(false)
  })

  it("never reports multipleCatchAlls together with noCatchAll", () => {
    const second = zone({ id: "z9", name: { en: "Everywhere" } })
    const withTwo = diagnose([catchAll, second], []).map((d) => d.id)
    expect(withTwo).toContain("multipleCatchAlls")
    expect(withTwo).not.toContain("noCatchAll")

    const gulf = zone({
      id: "z1",
      name: { en: "Gulf" },
      countries: ["SA"],
      rules: [rule({ id: "r1" })],
    })
    const withNone = diagnose([gulf], []).map((d) => d.id)
    expect(withNone).toContain("noCatchAll")
    expect(withNone).not.toContain("multipleCatchAlls")
  })

  it("stays quiet about duplicate catch-alls once the merchant channel is off", () => {
    const second = zone({ id: "z9", name: { en: "Everywhere" } })
    expect(
      diagnose([catchAll, second], [], { offersMerchantDelivery: false }),
    ).toEqual([])
  })

  it("flags a zone carrying more than one rate", () => {
    const overloaded = zone({
      id: "z1",
      name: { en: "Gulf" },
      rules: [
        rule({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
        rule({ id: "b", created_at: "2026-06-01T00:00:00.000Z" }),
      ],
    })
    expect(diagnose([catchAll, overloaded], [])).toContainEqual({
      id: "multipleRatesOnZone",
      severity: "warning",
      zones: ["Gulf"],
    })
  })

  it("flags a zone with no rate at all", () => {
    const bare = zone({ id: "z1", name: { en: "Gulf" }, countries: ["SA"] })
    expect(diagnose([catchAll, bare], [])).toContainEqual({
      id: "zoneWithoutRate",
      severity: "warning",
      zones: ["Gulf"],
    })
  })

  it("puts errors before warnings", () => {
    const gulf = zone({ id: "z1", name: { en: "Gulf" }, countries: ["SA"] })
    const found = diagnose([gulf], [rule({ id: "r1" })])
    expect(found[0]?.severity).toBe("error")
    expect(found.at(-1)?.severity).toBe("warning")
  })

  it("is silent on a correct configuration", () => {
    const gulf = zone({
      id: "z1",
      name: { en: "Gulf" },
      countries: ["SA"],
      rules: [rule({ id: "r1" })],
    })
    expect(diagnose([catchAll, gulf], [])).toEqual([])
  })
})

describe("otherCatchAll", () => {
  const rest = zone({ id: "rest", name: { en: "Rest of world" } })
  const gulf = zone({ id: "gulf", name: { en: "Gulf" }, countries: ["SA"] })

  it("names the catch-all a new zone would duplicate", () => {
    expect(otherCatchAll([gulf, rest])?.id).toBe("rest")
  })

  it("ignores the zone being edited, so the catch-all itself can be renamed", () => {
    expect(otherCatchAll([gulf, rest], "rest")).toBeNull()
  })

  it("returns null when there is no catch-all yet — including for the first zone", () => {
    expect(otherCatchAll([])).toBeNull()
    expect(otherCatchAll([gulf])).toBeNull()
  })
})

describe("orderZones", () => {
  it("lists the most specific zone first", () => {
    const rest = zone({ id: "rest", name: { en: "Rest" } })
    const country = zone({ id: "sa", name: { en: "SA" }, countries: ["SA"] })
    const state = zone({
      id: "riyadh",
      name: { en: "Riyadh" },
      countries: ["SA"],
      states: ["Riyadh"],
    })
    expect(orderZones([rest, country, state]).map((z) => z.id)).toEqual([
      "riyadh",
      "sa",
      "rest",
    ])
  })

  it("breaks a tie on priority, lower first", () => {
    const a = zone({ id: "a", name: { en: "A" }, countries: ["SA"], priority: 5 })
    const b = zone({ id: "b", name: { en: "B" }, countries: ["AE"], priority: 1 })
    expect(orderZones([a, b]).map((z) => z.id)).toEqual(["b", "a"])
  })
})

describe("rateFields", () => {
  it("asks for the columns each type actually reads", () => {
    expect(rateFields("fixed")).toEqual({
      amount_cents: true,
      amount_bps: false,
      per_kg_cents: false,
    })
    expect(rateFields("percentage")).toEqual({
      amount_cents: false,
      amount_bps: true,
      per_kg_cents: false,
    })
    expect(rateFields("weight_based")).toEqual({
      amount_cents: true,
      amount_bps: false,
      per_kg_cents: true,
    })
    expect(rateFields("free")).toEqual({
      amount_cents: false,
      amount_bps: false,
      per_kg_cents: false,
    })
  })

  it("treats an unknown type as fixed, matching the engine's default branch", () => {
    expect(rateFields("something-else")).toEqual(rateFields("fixed"))
  })
})

describe("rateColumns", () => {
  const input = {
    amountCents: 1500,
    amountBps: 250,
    perKgCents: 300,
  }

  it("keeps only the column its type reads", () => {
    expect(rateColumns({ ...input, type: "fixed" })).toEqual({
      amount_cents: 1500,
      amount_bps: 0,
      per_kg_cents: 0,
    })
    expect(rateColumns({ ...input, type: "percentage" })).toEqual({
      amount_cents: 0,
      amount_bps: 250,
      per_kg_cents: 0,
    })
    expect(rateColumns({ ...input, type: "weight_based" })).toEqual({
      amount_cents: 1500,
      amount_bps: 0,
      per_kg_cents: 300,
    })
  })

  it("zeroes everything for a free rate", () => {
    // The engine reads the column its `type` names, so switching a rule to
    // free without clearing the old column keeps it charging.
    expect(rateColumns({ ...input, type: "free" })).toEqual({
      amount_cents: 0,
      amount_bps: 0,
      per_kg_cents: 0,
    })
  })
})
