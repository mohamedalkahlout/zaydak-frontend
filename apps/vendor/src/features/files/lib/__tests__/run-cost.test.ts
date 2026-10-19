import { describe, it, expect } from "vitest"
import {
  remainingImages,
  runCostCents,
  runCostLabel,
} from "@/features/files/api/queries"

const shot = (cost: number) => ({ cost_cents: cost })

/**
 * The panel's two spend signals, as pure functions.
 *
 * They are tested together because they are read together — the CTA footer
 * says what this run costs and what the month has left afterwards — and
 * because they share one trap: a disabled cap and an exhausted one are both
 * "no number to show", and confusing them tells a vendor with unlimited quota
 * that they have run out.
 */

describe("runCostCents", () => {
  it("sums the picked shots rather than multiplying one unit price", () => {
    // The case that made summing necessary: a shot carries its own model, so
    // `enhance` (flux-2-pro, 6c) plus `cutout` (background-remover, 2c) is 8c.
    // `count x 6c` would have quoted 12c — over-charging the cheapest thing the
    // studio offers, on the control whose only job is to be right about price.
    expect(runCostCents([shot(6), shot(2)], 1)).toBe(8)
    expect(runCostCents([shot(6)], 1)).toBe(6)
  })

  it("multiplies the whole set by the variation count", () => {
    // Each variation is another full pass of every picked shot, matching what
    // the server enqueues.
    expect(runCostCents([shot(6), shot(2)], 4)).toBe(32)
    expect(runCostCents([shot(6)], 8)).toBe(48)
  })

  it("is zero when there is nothing to run", () => {
    expect(runCostCents([], 4)).toBe(0)
    expect(runCostCents([shot(6)], 0)).toBe(0)
  })

  // A shot the server has not priced must not poison the total with NaN — the
  // footer would then render "$NaN" on the primary action.
  it("treats a missing price as zero rather than NaN", () => {
    expect(
      runCostCents([shot(6), { cost_cents: undefined as unknown as number }], 1),
    ).toBe(6)
  })
})

describe("runCostLabel", () => {
  it("formats a cents total in major units", () => {
    expect(runCostLabel(6)).toBe("$0.06")
    expect(runCostLabel(48)).toBe("$0.48")
    expect(runCostLabel(144)).toBe("$1.44")
  })

  // Whole dollars drop the cents: "$6" beside a per-image price reads as a
  // number, "$6.00" reads as an unfilled template.
  it("prints whole dollars without trailing zeros", () => {
    expect(runCostLabel(100)).toBe("$1")
    expect(runCostLabel(200)).toBe("$2")
  })

  // Cents are integers all the way from the server; the division happens once,
  // here, so a price can never accumulate float error on the way to the button.
  it("keeps two decimals for any non-whole amount", () => {
    expect(runCostLabel(3)).toBe("$0.03")
    expect(runCostLabel(77)).toBe("$0.77")
  })

  // Before the registry answers there is no price. Rendering "$0" would be a
  // claim; rendering nothing lets the caller fall back to the generic note.
  it("returns null when there is nothing to price", () => {
    expect(runCostLabel(0)).toBeNull()
    expect(runCostLabel(-1)).toBeNull()
  })
})

describe("remainingImages", () => {
  it("reports what is left under a live cap", () => {
    expect(remainingImages({ used: 90, cap: 100 })).toBe(10)
    expect(remainingImages({ used: 0, cap: 100 })).toBe(100)
  })

  // `cap: 0` means the cap is switched off — unlimited. Returning 0 would make
  // the panel grey out every checkbox on the shops that have no limit at all.
  it("treats a disabled cap as unlimited, not exhausted", () => {
    expect(remainingImages({ used: 500, cap: 0 })).toBeNull()
    expect(remainingImages(undefined)).toBeNull()
  })

  // Over-cap is reachable: the monthly check is a read-then-check with no lock,
  // so a burst can land past it. Clamping keeps the panel from offering a
  // negative allowance.
  it("never reports a negative remainder", () => {
    expect(remainingImages({ used: 120, cap: 100 })).toBe(0)
  })
})
