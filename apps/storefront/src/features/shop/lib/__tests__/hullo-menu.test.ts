import { describe, expect, it } from "vitest"

import { hulloLinesFromCart, hulloMenuFromProducts } from "../hullo-menu"

describe("hulloMenuFromProducts", () => {
  it("maps a published product onto a window card and keeps a tag filter", () => {
    const menu = hulloMenuFromProducts(
      [
        {
          id: "p1",
          slug: "hullo-americano",
          name: { en: "iced americano", ar: "أمريكانو مثلج" },
          description: { en: "cold, dark, zero drama.", ar: "بارد" },
          image: { original: "https://cdn.example/americano.webp" },
          price_cents: 1600,
          selling_price_cents: 1400,
          in_stock: true,
          tags: [{ slug: "hullo-iced", name: { en: "iced", ar: "مثلج" } }],
        },
        { id: "p2", slug: "plain", name: { en: "No photo" }, price_cents: 1000 },
      ],
      "en",
    )
    expect(menu.items).toEqual([
      {
        id: "p1",
        name: "iced americano",
        blurb: "cold, dark, zero drama.",
        price: 14,
        tags: "hullo-iced",
        bg: "#BCD7EA",
        alt: "iced americano",
        image: {
          src: "https://cdn.example/americano.webp",
          width: 800,
          height: 800,
        },
        rotate: "-2.5deg",
        dy: "0px",
        inStock: true,
      },
    ])
    expect(menu.filters).toEqual([
      { id: "all", label: "all" },
      { id: "hullo-iced", label: "iced" },
    ])
  })

  it("reads the Arabic name and marks a sold-out row", () => {
    const menu = hulloMenuFromProducts(
      [
        {
          id: "p3",
          name: { en: "oat latte", ar: "لاتيه شوفان" },
          image: { original: "/hullo/p-latte.webp" },
          price_cents: 1700,
          in_stock: false,
        },
      ],
      "ar",
    )
    expect(menu.items[0]).toMatchObject({
      name: "لاتيه شوفان",
      price: 17,
      inStock: false,
      tags: "",
    })
    expect(menu.filters).toEqual([{ id: "all", label: "all" }])
  })
})

describe("hulloLinesFromCart", () => {
  it("keeps the server line total and a pending quantity", () => {
    const lines = hulloLinesFromCart(
      [
        {
          id: "line-1",
          name: "iced americano",
          variation_name: " large ",
          quantity: 1,
          total_price_cents: 1400,
        },
      ],
      () => 3,
    )
    expect(lines).toEqual([
      {
        id: "line-1",
        name: "iced americano",
        detail: "large",
        quantity: 3,
        totalCents: 1400,
      },
    ])
  })
})
