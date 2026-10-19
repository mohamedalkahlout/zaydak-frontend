import { describe, expect, it } from "vitest"
import {
  brandDefaults,
  brandSettingsInput,
  fileToSettingsImage,
  socialsInput,
  toImageInput,
} from "../brand"
import { contrastRatio, normalizeHex } from "../contrast"
import { isLikelyUrl, normalizeSocialUrl } from "../socials"
import type { SettingsShop } from "../../types"

const IMAGE = { id: "img-1", original: "https://cdn/o.png", thumbnail: "https://cdn/t.png" }

function shop(overrides: Partial<SettingsShop> = {}): SettingsShop {
  return {
    id: "shop-1",
    name: "Acme",
    slug: "acme",
    is_active: true,
    is_approved: true,
    ...overrides,
  }
}

describe("brandDefaults", () => {
  it("fills every key even for a shop with nothing set", () => {
    const d = brandDefaults(shop())
    expect(d.slogan).toBe("")
    expect(d.logo).toBeNull()
    expect(d.squareLogo).toBeNull()
    expect(d.primaryBackground).toBe("")
    // Every network is present as an empty string, so `register` always has a
    // defined value and the inputs never flip from uncontrolled to controlled.
    expect(Object.values(d.socials).every((v) => v === "")).toBe(true)
  })

  it("reads the brand group out of settings and the rest off the shop", () => {
    const d = brandDefaults(
      shop({
        description: "Kitchen things",
        logo: IMAGE,
        cover_image: IMAGE,
        socials: [{ id: "s1", name: "instagram", link: "https://instagram.com/acme" }],
        settings: {
          brand: {
            slogan: "Everything for your kitchen",
            square_logo: IMAGE,
            colors: { primary: { background: "#112233", foreground: "#ffffff" } },
          },
        },
      }),
    )

    expect(d.description).toBe("Kitchen things")
    expect(d.slogan).toBe("Everything for your kitchen")
    expect(d.squareLogo).toEqual(IMAGE)
    expect(d.primaryBackground).toBe("#112233")
    expect(d.secondaryBackground).toBe("")
    expect(d.socials.instagram).toBe("https://instagram.com/acme")
  })

  it("ignores a stored social whose name is not a network we render", () => {
    const d = brandDefaults(
      shop({ socials: [{ id: "s1", name: "tumblr", link: "https://tumblr.com/acme" }] }),
    )
    expect(Object.values(d.socials).every((v) => v === "")).toBe(true)
  })
})

describe("brandSettingsInput", () => {
  const base = brandDefaults(shop())

  it("sends null rather than a half-typed colour", () => {
    // The back-end rejects anything that is not #RRGGBB, and the error would
    // surface on a save bar with no field to point at.
    const out = brandSettingsInput({ ...base, primaryBackground: "#ab" })
    expect(out.colors).toBeNull()
  })

  it("keeps one half of a pair when only the other is set", () => {
    const out = brandSettingsInput({ ...base, primaryBackground: "#123456" })
    expect(out.colors).toEqual({
      primary: { background: "#123456", foreground: null },
      secondary: null,
    })
  })

  it("expands a three-digit hex and lower-cases it", () => {
    const out = brandSettingsInput({ ...base, primaryBackground: "#ABC" })
    expect(out.colors?.primary?.background).toBe("#aabbcc")
  })

  it("trims the slogan and sends null when it is blank", () => {
    expect(brandSettingsInput({ ...base, slogan: "  hi  " }).slogan).toBe("hi")
    expect(brandSettingsInput({ ...base, slogan: "   " }).slogan).toBeNull()
  })
})

describe("socialsInput", () => {
  const base = brandDefaults(shop())

  it("drops empty rows and adds a scheme to what is left", () => {
    const out = socialsInput(
      { ...base, socials: { ...base.socials, instagram: "instagram.com/acme" } },
      shop(),
    )
    expect(out).toEqual([{ name: "instagram", link: "https://instagram.com/acme" }])
  })

  it("carries through a network the pane does not render", () => {
    // `updateShop` replaces the whole set, so dropping this would delete the
    // row with no error and no undo.
    const stored = shop({
      socials: [{ id: "s1", name: "tumblr", link: "https://tumblr.com/acme" }],
    })
    const out = socialsInput({ ...base, socials: { ...base.socials, x: "https://x.com/acme" } }, stored)
    expect(out).toContainEqual({ name: "tumblr", link: "https://tumblr.com/acme" })
    expect(out).toContainEqual({ name: "x", link: "https://x.com/acme" })
  })
})

describe("toImageInput", () => {
  it("falls back to the original when there is no thumbnail", () => {
    expect(toImageInput({ id: "a", original: "o", thumbnail: "" })).toEqual({
      id: "a",
      original: "o",
      thumbnail: "o",
    })
  })

  it("returns null for an incomplete image, which is also how a slot is cleared", () => {
    expect(toImageInput(null)).toBeNull()
    expect(toImageInput({ id: "", original: "o", thumbnail: "t" })).toBeNull()
  })
})

describe("fileToSettingsImage", () => {
  // The library row's `url` is the slot's `original`; a row without a
  // thumbnail must still produce a complete `ImageInput`, or Save would send
  // a shape GraphQL rejects outright.
  it("maps a library row to the slot shape, using the url when there is no thumbnail", () => {
    expect(
      fileToSettingsImage({ id: "f1", url: "https://cdn/o.png", thumbnail: null }),
    ).toEqual({ id: "f1", original: "https://cdn/o.png", thumbnail: "https://cdn/o.png" })
  })

  it("keeps the thumbnail when the row has one", () => {
    expect(
      fileToSettingsImage({ id: "f1", url: "https://cdn/o.png", thumbnail: "https://cdn/t.png" })
        .thumbnail,
    ).toBe("https://cdn/t.png")
  })
})

describe("contrast", () => {
  it("normalises both hex forms", () => {
    expect(normalizeHex("ABC")).toBe("#aabbcc")
    expect(normalizeHex("#A1B2C3")).toBe("#a1b2c3")
    expect(normalizeHex("#ab")).toBeNull()
  })

  it("scores black on white at the WCAG maximum", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1)
  })

  it("returns null until both sides are colours", () => {
    expect(contrastRatio("#000000", "")).toBeNull()
  })
})

describe("social urls", () => {
  it("leaves a bare handle alone — it cannot be resolved without the network", () => {
    expect(normalizeSocialUrl("@acme")).toBe("@acme")
    expect(isLikelyUrl("@acme")).toBe(false)
  })

  it("treats an empty field as valid, not as an error", () => {
    expect(isLikelyUrl("")).toBe(true)
  })

  it("accepts a host typed without a scheme", () => {
    expect(isLikelyUrl("instagram.com/acme")).toBe(true)
  })
})
