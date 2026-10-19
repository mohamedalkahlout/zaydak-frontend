import type { ShippingRule, ShippingZone, TranslatedText } from "../types"

/**
 * Reading the shipping configuration the way the back-end reads it.
 *
 * `selectShippingRule` (`back-end/src/shipping/shipping-zone.helper.ts`) has
 * three behaviours that are invisible from a list of rows, and each one has
 * silently broken a real checkout:
 *
 *  1. **Zones win, absolutely.** The moment a shop has one zone, *unzoned rules
 *     stop being consulted* — the helper takes the zone branch and never
 *     reaches the legacy query. A rate the vendor created first just stops
 *     applying, with nothing on screen to say so.
 *  2. **A zone with no catch-all is a wall.** A shop with zones but none
 *     matching the destination returns `null`, which checkout reports as
 *     "can't ship there". A zone whose `countries` is empty is the catch-all
 *     that prevents it.
 *  3. **Only the newest rate on a zone applies.** The helper takes
 *     `zone.rules[0]` after ordering by `created_at desc`. A second rate added
 *     to the same zone is dead weight.
 *
 * Everything here is pure so the pane can warn about all three without
 * re-deriving the rules in a component.
 */

export function textOf(value: TranslatedText | null | undefined): string {
  if (!value) return ""
  return value.en?.trim() || value.ar?.trim() || ""
}

/**
 * Names joined the way the active locale lists them: "Gulf, Local" in English,
 * "Gulf، وLocal" in Arabic. A hardcoded separator is right in one language
 * only.
 */
export function formatList(items: readonly string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(
    items,
  )
}

/** A zone with no countries listed catches everything else. */
export function isCatchAll(zone: Pick<ShippingZone, "countries">): boolean {
  return zone.countries.length === 0
}

/**
 * The catch-all a zone would duplicate, or null.
 *
 * From this pane two catch-alls are never intended: the dialog cannot edit
 * `states`, so they match exactly the same destinations and only `priority`
 * decides which is charged — and on a tie, database row order, which nothing
 * on screen can show. `excludeId` is the zone being edited, so renaming the
 * existing catch-all is not reported as a conflict with itself.
 */
export function otherCatchAll(
  zones: ShippingZone[],
  excludeId?: string,
): ShippingZone | null {
  return zones.find((zone) => isCatchAll(zone) && zone.id !== excludeId) ?? null
}

/**
 * The rate the back-end would actually charge for this zone.
 *
 * Newest by `created_at`, matching the helper's `orderBy: { created_at: 'desc' }`
 * — not the first in the array, which arrives in whatever order the API sent.
 */
export function effectiveRate(zone: ShippingZone): ShippingRule | null {
  if (zone.rules.length === 0) return null
  return [...zone.rules].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )[0]!
}

/** The rates on a zone that will never be charged, newest-first order. */
export function shadowedRates(zone: ShippingZone): ShippingRule[] {
  const winner = effectiveRate(zone)
  if (!winner) return []
  return zone.rules.filter((rule) => rule.id !== winner.id)
}

export type DiagnosticId =
  /** No zones and no unzoned rates — the shop cannot quote delivery anywhere. */
  | "nothingConfigured"
  /** Zones exist, so these unzoned rates are no longer consulted. */
  | "unzonedShadowed"
  /** Zones exist but none is a catch-all — anywhere unlisted gets no rate. */
  | "noCatchAll"
  /** More than one catch-all — same destinations, so only one is ever charged. */
  | "multipleCatchAlls"
  /** A zone carries more than one rate; only the newest is charged. */
  | "multipleRatesOnZone"
  /**
   * A zone exists with no rate at all — it matches, and checkout then refuses
   * the order (`destination_excluded`), the same verdict as no zone matching.
   */
  | "zoneWithoutRate"

export interface Diagnostic {
  id: DiagnosticId
  severity: "error" | "warning"
  /** Zone names the message needs to point at, when it is about specific ones. */
  zones?: string[]
  /** How many rows the message covers, for a pluralised label. */
  count?: number
}

/**
 * Which delivery channels the shop offers customers.
 *
 * Every warning below is about the shop's OWN delivery, and it is the reason
 * this argument exists: a merchant shipping only through carriers was told in
 * red that "no shipping is configured" while their carrier list was working,
 * and no zone they could add would have made the message go away. Optional so
 * a caller that has not loaded the settings yet keeps the old reading — both
 * channels on, which is what every shop was before they existed.
 */
export interface DeliveryChannels {
  offersMerchantDelivery?: boolean
  offersCarrierDelivery?: boolean
}

/**
 * Everything wrong with the current configuration, worst first.
 *
 * `nothingConfigured` is an error rather than a warning because it is the state
 * every shop starts in and it makes `verifyCheckout` answer
 * `shipping_available: false` for every address on earth — which is exactly how
 * the storefront's checkout came to look broken. It is NOT that state for a
 * shop delivering by carrier: there the zone list is meant to be empty, and
 * checkout prices the carrier's own options instead.
 */
export function diagnose(
  zones: ShippingZone[],
  unzonedRules: ShippingRule[],
  channels: DeliveryChannels = {},
  /**
   * A city-matched shop (Palestine) delivers inside its own cities. A missing
   * rest-of-world zone is that setup, not a mistake, so the catch-all error
   * stays off the pane.
   */
  opts: { domesticOnly?: boolean } = {},
): Diagnostic[] {
  const found: Diagnostic[] = []

  // The shop's own delivery is switched off: its zones and rates price
  // nothing, so nothing about them is worth warning over. Kept on file rather
  // than deleted — a merchant pausing that channel for a week must not come
  // back to an empty list — which is exactly why they are still here to be
  // read, and exactly why reading them as "the shop's configuration" was wrong.
  if (channels.offersMerchantDelivery === false) return found

  if (zones.length === 0) {
    if (unzonedRules.length === 0) {
      // A carrier-only shop is not misconfigured, it is configured elsewhere.
      if (channels.offersCarrierDelivery !== true) {
        found.push({ id: "nothingConfigured", severity: "error" })
      }
    }
    // With no zones the legacy rule applies everywhere, so there is nothing
    // else to warn about — the other three are all zone-branch behaviours.
    return found
  }

  const catchAlls = zones.filter(isCatchAll)
  if (catchAlls.length === 0 && !opts.domesticOnly) {
    found.push({ id: "noCatchAll", severity: "error" })
  } else if (catchAlls.length > 1) {
    // A warning, not an error: nothing is blocked, one zone is silently
    // ignored — the same class as `multipleRatesOnZone`. The zone dialog
    // refuses to create a second catch-all, so this only ever fires on rows
    // that predate that guard or were written through the API.
    found.push({
      id: "multipleCatchAlls",
      severity: "warning",
      zones: catchAlls.map((zone) => textOf(zone.name)).filter(Boolean),
    })
  }

  if (unzonedRules.length > 0) {
    found.push({
      id: "unzonedShadowed",
      severity: "warning",
      count: unzonedRules.length,
    })
  }

  const overloaded = zones.filter((zone) => shadowedRates(zone).length > 0)
  if (overloaded.length > 0) {
    found.push({
      id: "multipleRatesOnZone",
      severity: "warning",
      zones: overloaded.map((zone) => textOf(zone.name)).filter(Boolean),
    })
  }

  const empty = zones.filter((zone) => zone.rules.length === 0)
  if (empty.length > 0) {
    found.push({
      id: "zoneWithoutRate",
      severity: "warning",
      zones: empty.map((zone) => textOf(zone.name)).filter(Boolean),
    })
  }

  return found.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
  )
}

/**
 * Sort zones the way the matcher considers them: most specific first, then by
 * `priority` ascending. Purely presentational — it makes the list read in the
 * order a destination is actually tested against.
 */
export function orderZones(zones: ShippingZone[]): ShippingZone[] {
  const specificity = (zone: ShippingZone) =>
    (zone.countries.length > 0 ? 1 : 0) + (zone.states.length > 0 ? 2 : 0)
  return [...zones].sort(
    (a, b) => specificity(b) - specificity(a) || a.priority - b.priority,
  )
}

/**
 * The numbers a rate needs, per type.
 *
 * Sending `amount_cents` on a percentage rule (or `amount_bps` on a fixed one)
 * leaves the unused column set, and the fee engine reads whichever its `type`
 * says — so a rule switched between types keeps charging from the stale column
 * unless the old one is zeroed. The dialog uses this to decide which inputs to
 * show *and* which columns to clear on save.
 */
export function rateFields(type: string): {
  amount_cents: boolean
  amount_bps: boolean
  per_kg_cents: boolean
} {
  switch (type) {
    case "percentage":
      return { amount_cents: false, amount_bps: true, per_kg_cents: false }
    case "weight_based":
      return { amount_cents: true, amount_bps: false, per_kg_cents: true }
    case "free":
      return { amount_cents: false, amount_bps: false, per_kg_cents: false }
    case "fixed":
    default:
      return { amount_cents: true, amount_bps: false, per_kg_cents: false }
  }
}

/**
 * Normalise a rate into the columns the engine will read, zeroing the rest.
 *
 * Written here rather than inline in the dialog so create and update cannot
 * disagree about what "switch this rule to free" means.
 */
export function rateColumns(input: {
  type: string
  amountCents: number
  amountBps: number
  perKgCents: number
}): { amount_cents: number; amount_bps: number; per_kg_cents: number } {
  const used = rateFields(input.type)
  return {
    amount_cents: used.amount_cents ? input.amountCents : 0,
    amount_bps: used.amount_bps ? input.amountBps : 0,
    per_kg_cents: used.per_kg_cents ? input.perKgCents : 0,
  }
}
