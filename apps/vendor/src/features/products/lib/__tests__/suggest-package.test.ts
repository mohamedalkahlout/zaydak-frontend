import { describe, it, expect } from "vitest"

import type { PackageType, ShopPackage } from "@/features/shipping/types"
import {
  estimateCartonGrams,
  suggestPackage,
} from "@/features/products/lib/suggest-package"

function pkg(
  id: string,
  [l, w, h]: [number, number, number],
  extra: { type?: PackageType; isDefault?: boolean } = {},
): ShopPackage {
  return {
    id,
    shop_id: "shop-1",
    name: id,
    package_type: extra.type ?? "BOX",
    length_mm: l * 10,
    width_mm: w * 10,
    height_mm: h * 10,
    empty_weight_grams: 0,
    is_default: extra.isDefault ?? false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }
}

describe("suggestPackage", () => {
  it("picks the smallest box the product fits in once padded", () => {
    const boxes = [
      pkg("large", [60, 40, 40]),
      pkg("medium", [40, 30, 20]),
      pkg("small", [20, 15, 10]),
    ]

    // 30 × 20 × 10 needs 34 × 24 × 14: "small" is too small, "medium" is the
    // tightest of the two that fit.
    expect(suggestPackage([30, 20, 10], boxes)).toEqual({
      kind: "existing",
      packageId: "medium",
    })
  })

  it("does not care which way round the product or the box was measured", () => {
    const boxes = [pkg("tall", [20, 30, 50])]

    expect(suggestPackage([10, 45, 25], boxes)).toEqual({
      kind: "existing",
      packageId: "tall",
    })
  })

  it("counts the allowance: a box the bare product fits is not enough", () => {
    // 20 × 15 × 10 fits the product exactly and leaves no room to pack it.
    const boxes = [pkg("exact", [20, 15, 10])]

    expect(suggestPackage([20, 15, 10], boxes).kind).toBe("new")
  })

  it("only considers boxes, never an envelope or a mailer bag", () => {
    const boxes = [
      pkg("mailer", [50, 40, 20], { type: "SOFT_PACKAGE" }),
      pkg("envelope", [50, 40, 20], { type: "ENVELOPE" }),
    ]

    expect(suggestPackage([10, 10, 5], boxes).kind).toBe("new")
  })

  it("prefers the store default between two boxes of the same volume", () => {
    const boxes = [
      pkg("other", [40, 30, 20]),
      pkg("default", [30, 40, 20], { isDefault: true }),
    ]

    expect(suggestPackage([20, 20, 10], boxes)).toEqual({
      kind: "existing",
      packageId: "default",
    })
  })

  it("proposes a box at the padded size, in the order it was typed, when none fits", () => {
    const result = suggestPackage([30, 20.2, 5], [pkg("small", [10, 10, 10])])

    // Each side grows by 4 cm and rounds up to a whole centimetre.
    expect(result).toEqual({
      kind: "new",
      dimensionsCm: [34, 25, 9],
      emptyWeightGrams: estimateCartonGrams([34, 25, 9]),
    })
  })

  it("proposes a box when the shop has none at all", () => {
    expect(suggestPackage([10, 10, 10], []).kind).toBe("new")
  })
})

describe("estimateCartonGrams", () => {
  it("weighs the board a regular slotted carton is cut from", () => {
    // Largest first: 34, 24, 14. Sheet = 2 × (34 + 24) × (14 + 24) = 4408 cm²,
    // which at 10 g per 200 cm² is 220.4 g — rounded up to 230 g.
    expect(estimateCartonGrams([24, 14, 34])).toBe(230)
  })

  it("never reads as weightless", () => {
    expect(estimateCartonGrams([1, 1, 1])).toBeGreaterThan(0)
  })
})
