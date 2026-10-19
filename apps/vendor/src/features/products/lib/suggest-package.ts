import type { ShopPackage } from "@/features/shipping/types"

/** Room added to each of the product's measurements for packing — 2 cm on every side. */
export const PACKING_ALLOWANCE_CM = 4

/**
 * Plain single-wall corrugated board weighs about 500 g per m², so every
 * 200 cm² of it is 10 g.
 */
const BOARD_CM2_PER_10_GRAMS = 200

export type Dimensions = [length: number, width: number, height: number]

export type PackageSuggestion =
  | { kind: "existing"; packageId: string }
  /**
   * No saved box fits: the box to propose instead — its length, width and
   * height in whole cm, in the order the product's were typed, and what it
   * should weigh empty.
   */
  | { kind: "new"; dimensionsCm: Dimensions; emptyWeightGrams: number }

const largestFirst = (values: readonly number[]) =>
  [...values].sort((a, b) => b - a)

const volume = (sides: readonly number[]) => sides.reduce((x, y) => x * y, 1)

/**
 * What an empty carton of these measurements weighs, in grams. A proposed box
 * does not exist yet, so nobody can put it on a scale: a regular slotted carton
 * is one sheet of board — its four walls end to end, as tall as the box plus
 * the flaps that close it, half its width at the top and again at the bottom.
 * Rounded up to 10 g, so even the smallest carton never reads as weightless.
 */
export function estimateCartonGrams(dimensionsCm: Dimensions): number {
  const [length, width, height] = largestFirst(dimensionsCm)
  const sheet = 2 * (length + width) * (height + width)
  return Math.ceil(sheet / BOARD_CM2_PER_10_GRAMS) * 10
}

/**
 * The smallest saved box the product fits in once padded, or — when none is
 * big enough — a new box at the padded size for the vendor to approve.
 *
 * Only `BOX` packages are candidates: the allowance is cushioning room inside
 * a rigid carton, which an envelope or a mailer bag does not have. Orientation
 * does not matter, so sides are compared largest to largest. Two boxes of the
 * same volume go to the store default, the one the shop already stocks.
 */
export function suggestPackage(
  productCm: Dimensions,
  packages: readonly ShopPackage[],
): PackageSuggestion {
  // A proposed box keeps the product's own length, width and height, each
  // grown by the allowance, so the vendor can read it against what they typed.
  // Only the comparison is orientation-free.
  const paddedCm = productCm.map((d) =>
    Math.ceil(d + PACKING_ALLOWANCE_CM),
  ) as Dimensions
  const neededMm = largestFirst(paddedCm.map((d) => d * 10))

  const fitting = packages
    .filter((pkg) => pkg.package_type === "BOX")
    .map((pkg) => ({
      pkg,
      sides: largestFirst([pkg.length_mm, pkg.width_mm, pkg.height_mm]),
    }))
    .filter(({ sides }) => sides.every((side, i) => side >= neededMm[i]))
    .sort(
      (a, b) =>
        volume(a.sides) - volume(b.sides) ||
        Number(b.pkg.is_default) - Number(a.pkg.is_default),
    )

  if (fitting.length > 0) {
    return { kind: "existing", packageId: fitting[0].pkg.id }
  }
  return {
    kind: "new",
    dimensionsCm: paddedCm,
    emptyWeightGrams: estimateCartonGrams(paddedCm),
  }
}
