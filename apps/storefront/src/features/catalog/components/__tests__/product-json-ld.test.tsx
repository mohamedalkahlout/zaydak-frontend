import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

import { ProductJsonLd } from "../product-json-ld"
import type { ProductMeta } from "../../lib/product-server"

describe("ProductJsonLd", () => {
  const baseProduct: ProductMeta = {
    id: "prod_1",
    slug: "classic-mug",
    name: { en: "Classic Mug", ar: "كوب كلاسيكي" },
    description: { en: "A ceramic coffee mug.", ar: "كوب قهوة سيراميك." },
    seo_title: null,
    seo_description: null,
    image: { original: "https://example.com/mug.jpg" },
    gallery: [{ original: "https://example.com/mug-side.jpg" }],
    price_cents: 2500,
    selling_price_cents: 2000,
    in_stock: true,
    sku: "MUG-001",
    brand: "Acme Ceramics",
  }

  it("renders valid Schema.org Product JSON-LD script", () => {
    const { container } = render(
      <ProductJsonLd
        product={baseProduct}
        shopUrl="http://localhost:3003/acme"
        shopName="Acme Shop"
        currency="SAR"
        locale="en"
      />,
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()

    const data = JSON.parse(script!.textContent || "{}")
    expect(data["@context"]).toBe("https://schema.org")
    expect(data["@type"]).toBe("Product")
    expect(data.name).toBe("Classic Mug")
    expect(data.description).toBe("A ceramic coffee mug.")
    expect(data.sku).toBe("MUG-001")
    expect(data.brand).toEqual({ "@type": "Brand", name: "Acme Ceramics" })
    expect(data.image).toContain("https://example.com/mug.jpg")
    expect(data.image).toContain("https://example.com/mug-side.jpg")

    expect(data.offers).toEqual({
      "@type": "Offer",
      url: "http://localhost:3003/acme/products/classic-mug",
      priceCurrency: "SAR",
      price: "20.00",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    })
  })

  it("reflects out-of-stock availability", () => {
    const { container } = render(
      <ProductJsonLd
        product={{ ...baseProduct, in_stock: false }}
        shopUrl="http://localhost:3003/acme"
        shopName="Acme Shop"
        currency="SAR"
        locale="en"
      />,
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.textContent || "{}")
    expect(data.offers.availability).toBe("https://schema.org/OutOfStock")
  })

  it("falls back to shop name when product brand is absent", () => {
    const { container } = render(
      <ProductJsonLd
        product={{ ...baseProduct, brand: null }}
        shopUrl="http://localhost:3003/acme"
        shopName="Default Store"
        currency="SAR"
        locale="en"
      />,
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script!.textContent || "{}")
    expect(data.brand).toEqual({ "@type": "Brand", name: "Default Store" })
  })
})
