import { describe, expect, it } from "vitest"

import { DOUGHN_CONTENT } from "../content"
import {
  applyDoughnTheme,
  DOUGHN_STORY_LINE_KEYS,
  draftFromSettings,
  settingsFromDraft,
  slotsFromProducts,
} from "../theme"

describe("applyDoughnTheme", () => {
  it("leaves the sample bakery untouched when nothing is saved", () => {
    const content = applyDoughnTheme(null)
    expect(content.copy.en.paint).toEqual(DOUGHN_CONTENT.copy.en.paint)
    expect(content.copy.ar.paint).toEqual(DOUGHN_CONTENT.copy.ar.paint)
    expect(content.items[0]?.name.en).toBe("tamees")
    expect(content.items[0]?.image).toBeUndefined()
    expect(content.images).toBeUndefined()
    expect(content.copy.en.caps.map(([, line]) => line)).toEqual(
      DOUGHN_CONTENT.copy.en.caps.map(([, line]) => line),
    )
    expect(DOUGHN_CONTENT.copy.en.caps).toHaveLength(DOUGHN_STORY_LINE_KEYS.length)
  })

  it("replaces the English headline and keeps the Arabic sample when the line is still the default", () => {
    const content = applyDoughnTheme({
      texts: { headline1: "open later" },
    })
    expect(content.copy.en.paint[0]).toBe("open later")
    expect(content.copy.ar.paint[0]).toBe("open later")
    expect(content.copy.ar.paint[1]).toBe(DOUGHN_CONTENT.copy.ar.paint[1])
  })

  it("fills product slots from a collection and keeps the sample in the rest", () => {
    const [first] = slotsFromProducts(
      [
        {
          name: { en: "White musk", ar: "مسك أبيض" },
          slug: "white-musk",
          image: { original: "https://cdn.example/white.jpg" },
          selling_price_cents: 4500,
        },
      ],
      (slug) => `/aromatic/products/${slug}`,
    )
    const content = applyDoughnTheme({ collectionId: "col-1" }, [first!])
    expect(content.items[0]).toMatchObject({
      id: "tamees",
      name: { en: "White musk", ar: "مسك أبيض" },
      price: 45,
      image: "https://cdn.example/white.jpg",
      href: "/aromatic/products/white-musk",
    })
    expect(content.items[1]?.name.en).toBe("sesame ka'ak")
    expect(content.items).toHaveLength(8)
  })

  it("uses an uploaded hero and cut-out when no collection product fills that slot", () => {
    const content = applyDoughnTheme({
      images: {
        hero: "https://cdn.example/shop.jpg",
        products: ["https://cdn.example/loaf.jpg"],
      },
    })
    expect(content.images?.hero).toBe("https://cdn.example/shop.jpg")
    expect(content.images?.door).toBeUndefined()
    expect(content.items[0]?.image).toBe("https://cdn.example/loaf.jpg")
    expect(content.items[0]?.name.en).toBe("tamees")
  })

  it("replaces the street photos and one story line, and keeps the Arabic sample on the rest", () => {
    const content = applyDoughnTheme({
      texts: { caption1: "the ovens are ours" },
      images: {
        daylight: "https://cdn.example/day.jpg",
        frame: "https://cdn.example/frame.jpg",
        door: "https://cdn.example/door.jpg",
        doorDay: "https://cdn.example/door-day.jpg",
        shutter: "https://cdn.example/shutter.jpg",
        interior: "https://cdn.example/inside.jpg",
      },
    })
    expect(content.images).toEqual({
      daylight: "https://cdn.example/day.jpg",
      frame: "https://cdn.example/frame.jpg",
      door: "https://cdn.example/door.jpg",
      doorDay: "https://cdn.example/door-day.jpg",
      shutter: "https://cdn.example/shutter.jpg",
      interior: "https://cdn.example/inside.jpg",
    })
    expect(content.copy.en.caps[0]?.[1]).toBe("the ovens are ours")
    expect(content.copy.ar.caps[0]?.[1]).toBe("the ovens are ours")
    expect(content.copy.en.caps[0]?.[0]).toBe(DOUGHN_CONTENT.copy.en.caps[0]?.[0])
    expect(content.copy.ar.caps[1]?.[1]).toBe(DOUGHN_CONTENT.copy.ar.caps[1]?.[1])
  })

  it("uses the shop name, address and time zone, and keeps a saved brand and the sample hours", () => {
    const content = applyDoughnTheme(
      { texts: { brand: "Aromatic" } },
      undefined,
      {
        shop: {
          name: "The other bakery",
          timeZone: "Asia/Dubai",
          address: "Street 2, Al Olaya, Riyadh",
          city: "Riyadh",
          lat: 24.7,
          lng: 46.7,
        },
      },
    )
    expect(content.brand).toBe("Aromatic")
    expect(content.timeZone).toBe("Asia/Dubai")
    expect(content.copy.en.whereD).toBe("Street 2, Al Olaya, Riyadh")
    expect(content.copy.ar.whereD).toBe("Street 2, Al Olaya, Riyadh")
    expect(content.copy.en.city).toBe("Riyadh")
    expect(content.copy.ar.closingSmall).toBe(" . Riyadh")
    expect(content.mapUrl).toBe("https://www.google.com/maps/search/?api=1&query=24.7,46.7")
    expect(content.hours).toEqual(DOUGHN_CONTENT.hours)
  })

  it("replaces the sample wordmark when the theme has not named a brand", () => {
    const content = applyDoughnTheme(null, undefined, {
      shop: { name: "Franc", timeZone: "not-a-zone", address: "Al Balad" },
    })
    expect(content.brand).toBe("Franc")
    expect(content.timeZone).toBe(DOUGHN_CONTENT.timeZone)
    expect(content.mapUrl).toContain(encodeURIComponent("Al Balad"))
  })

  it("round-trips a draft through the saved shape", () => {
    const draft = draftFromSettings({
      texts: { brand: "Aromatic", ctaBoard: "Shop" },
      images: { hero: "https://cdn.example/shop.jpg" },
      collectionId: "col-1",
    })
    expect(draft.brand).toBe("Aromatic")
    expect(draft.headline1).toBe(DOUGHN_CONTENT.copy.en.paint[0])
    expect(draft.caption1).toBe(DOUGHN_CONTENT.copy.en.caps[0]?.[1])
    expect(draft.door).toBeNull()
    expect(draft.products).toHaveLength(8)
    const saved = settingsFromDraft(draft)
    expect(saved.collectionId).toBe("col-1")
    expect(saved.images?.door).toBeNull()
    expect(saved.texts?.caption1).toBe(DOUGHN_CONTENT.copy.en.caps[0]?.[1])
  })
})
