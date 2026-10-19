import { describe, expect, it } from "vitest"

import {
  doughnAddressLine,
  doughnHomeContent,
  isCheckoutPath,
  isShopHomePath,
  storefrontCheckoutKind,
  storefrontHomeKind,
} from "../shop-home"
import { railPiecesFromProducts } from "../rail-pieces"

describe("storefront home", () => {
  it("renders doughn only when that template is chosen", () => {
    expect(storefrontHomeKind("doughn")).toBe("doughn")
    expect(storefrontHomeKind("drip")).toBe("drip")
    expect(storefrontHomeKind(null)).toBe("default")
    expect(storefrontHomeKind("hullo")).toBe("hullo")
    expect(storefrontHomeKind("rail")).toBe("rail")
    expect(storefrontHomeKind("personne")).toBe("personne")
    expect(storefrontHomeKind("jurat")).toBe("jurat")
    expect(storefrontHomeKind(undefined)).toBe("default")
  })

  it("themes checkout for doughn, drip, rail and hullo", () => {
    expect(storefrontCheckoutKind("doughn")).toBe("doughn")
    expect(storefrontCheckoutKind("drip")).toBe("drip")
    expect(storefrontCheckoutKind("rail")).toBe("rail")
    expect(storefrontCheckoutKind("hullo")).toBe("hullo")
    expect(storefrontCheckoutKind("personne")).toBe("personne")
    expect(storefrontCheckoutKind("jurat")).toBe("jurat")
    expect(storefrontCheckoutKind(null)).toBe("default")
    expect(storefrontCheckoutKind("unknown")).toBe("default")
  })

  it("treats the apex shop path and a host root as the home", () => {
    expect(isShopHomePath("/aromatic", "/aromatic")).toBe(true)
    expect(isShopHomePath("/aromatic/", "/aromatic")).toBe(true)
    expect(isShopHomePath("/aromatic/products", "/aromatic")).toBe(false)
    expect(isShopHomePath("/", "")).toBe(true)
    expect(isShopHomePath("/products", "")).toBe(false)
  })

  it("matches checkout without matching a longer path", () => {
    expect(isCheckoutPath("/aromatic/checkout", "/aromatic")).toBe(true)
    expect(isCheckoutPath("/aromatic/checkout/", "/aromatic")).toBe(true)
    expect(isCheckoutPath("/checkout", "")).toBe(true)
    expect(isCheckoutPath("/checkout-help", "")).toBe(false)
    expect(isCheckoutPath("/aromatic/products", "/aromatic")).toBe(false)
  })

  it("paints saved street photos and a story line on the doughn home", () => {
    const content = doughnHomeContent(
      {
        texts: { caption2: "come through" },
        images: {
          door: "https://cdn.example/door.jpg",
          daylight: "https://cdn.example/day.jpg",
          interior: "https://cdn.example/inside.jpg",
        },
      },
      [],
      "/aromatic",
      "SAR",
    )
    expect(content.images).toMatchObject({
      door: "https://cdn.example/door.jpg",
      daylight: "https://cdn.example/day.jpg",
      interior: "https://cdn.example/inside.jpg",
    })
    expect(content.images?.shutter).toBeUndefined()
    expect(content.copy.en.caps[1]?.[1]).toBe("come through")
    expect(content.items[0]?.name.en).toBe("tamees")
  })

  it("paints the shop address and keeps the sample hours", () => {
    expect(doughnAddressLine({ district: "Al Olaya", city: "Riyadh" })).toBe(
      "Al Olaya, Riyadh",
    )
    expect(
      doughnAddressLine({ formattedAddress: "Street 2", city: "Riyadh" }),
    ).toBe("Street 2")
    const content = doughnHomeContent(null, [], "/franc", "SAR", {
      name: "Franc",
      timeZone: "Asia/Riyadh",
      address: "Al Olaya, Riyadh",
      city: "Riyadh",
    })
    expect(content.brand).toBe("Franc")
    expect(content.copy.en.whereD).toBe("Al Olaya, Riyadh")
    expect(content.hours.open).toBe(240)
  })

  it("hangs a shop product on the rail and links it with the tenant base", () => {
    const pieces = railPiecesFromProducts(
      [
        {
          id: "p1",
          slug: "before",
          name: { en: "Before", ar: "قبل" },
          image: { original: "https://cdn.example/front.webp" },
          gallery: [{ original: "https://cdn.example/side.webp" }],
        },
        { id: "p2", slug: "plain", name: { en: "No photo" } },
      ],
      "/acme",
      "en",
    )
    expect(pieces).toEqual([
      {
        id: "p1",
        name: "Before",
        type: "",
        colorName: "",
        front: "https://cdn.example/front.webp",
        side: "https://cdn.example/side.webp",
        turn: "https://cdn.example/side.webp",
        back: undefined,
        href: "/acme/products/before",
      },
    ])
  })
})
