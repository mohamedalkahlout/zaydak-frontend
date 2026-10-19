import { describe, it, expect } from "vitest"
import type { Product } from "@/features/products/types"
import {
  productFilterFromProduct,
  productFilterFromReview,
  productHref,
  ratingTone,
  sharePercent,
} from "../reviews"

describe("ratingTone", () => {
  // The thresholds mirror the back-end's ReviewSentimentService. If one side
  // moves, this is the test that should force the other to move with it.
  it("splits at 4 and 3", () => {
    expect(ratingTone(5)).toBe("positive")
    expect(ratingTone(4)).toBe("positive")
    expect(ratingTone(3)).toBe("neutral")
    expect(ratingTone(2)).toBe("negative")
    expect(ratingTone(1)).toBe("negative")
  })
})

describe("sharePercent", () => {
  it("returns a rounded percentage", () => {
    expect(sharePercent(1, 3)).toBe(33)
    expect(sharePercent(3, 3)).toBe(100)
  })

  it("returns 0 rather than NaN for an empty shop", () => {
    // A NaN here reaches the DOM as `width: NaN%`, which renders a full-width
    // bar — the shop with no reviews would look like it had five stars.
    expect(sharePercent(0, 0)).toBe(0)
  })
})

describe("productHref", () => {
  it("builds the store-scoped product URL", () => {
    expect(productHref("acme", "dive-watch")).toBe(
      "/store/acme/products/dive-watch",
    )
  })

  it("returns null when either half is missing", () => {
    // A review outlives a hard-deleted product, so the slug really can be gone.
    expect(productHref("acme", null)).toBeNull()
    expect(productHref(null, "dive-watch")).toBeNull()
    expect(productHref("acme", undefined)).toBeNull()
  })
})

// Both mappers feed the same chip, so what matters is that a product picked in
// the toolbar and the same product seeded from a row read identically.
describe("productFilterFromReview", () => {
  it("labels with the translated name and keeps the thumbnail", () => {
    expect(
      productFilterFromReview({
        id: "p1",
        name: { en: "Dive Watch", ar: "ساعة غوص" },
        slug: "dive-watch",
        image: "https://cdn.example/p1.jpg",
      }),
    ).toEqual({
      id: "p1",
      label: "Dive Watch",
      image: "https://cdn.example/p1.jpg",
    })
  })

  it("falls back to the slug when the name is empty", () => {
    // An imported product can carry an empty name blob; the slug is the one
    // field that is always there.
    expect(
      productFilterFromReview({ id: "p2", name: null, slug: "no-name", image: null }),
    ).toEqual({ id: "p2", label: "no-name", image: null })
    expect(
      productFilterFromReview({ id: "p3", name: {}, slug: "blank", image: null })
        .label,
    ).toBe("blank")
  })
})

describe("productFilterFromProduct", () => {
  const product = (over: Partial<Product>): Product =>
    ({ id: "p1", name: { en: "Dive Watch" }, slug: "dive-watch", ...over }) as Product

  it("prefers the thumbnail, then the original, then nothing", () => {
    expect(
      productFilterFromProduct(
        product({ image: { thumbnail: "thumb.jpg", original: "full.jpg" } }),
      ).image,
    ).toBe("thumb.jpg")
    expect(
      productFilterFromProduct(product({ image: { original: "full.jpg" } })).image,
    ).toBe("full.jpg")
    expect(productFilterFromProduct(product({ image: null })).image).toBeNull()
    expect(productFilterFromProduct(product({})).image).toBeNull()
  })

  it("labels the same way as the review mapper", () => {
    expect(productFilterFromProduct(product({})).label).toBe("Dive Watch")
    expect(productFilterFromProduct(product({ name: null })).label).toBe(
      "dive-watch",
    )
  })
})
