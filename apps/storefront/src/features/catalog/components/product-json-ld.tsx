import { imageRef, imageRefs, text } from "@/shared/lib/multilang"
import type { ProductMeta } from "../lib/product-server"

interface ProductJsonLdProps {
  product: ProductMeta
  /**
   * The shop's absolute URL base, from `canonicalShopBase`.
   *
   * A base rather than a slug, because there is no longer one way to turn a
   * slug into a URL: a shop is reachable at `zaydak.com/acme/...`, at
   * `acme.zaydak.com/...` and — once a merchant promotes their own domain, at
   * which point the other two redirect — at `acme.com/...`. This component can
   * see neither which apex is configured nor which domain is primary, and the
   * second of those is not derivable at all. Handing it the resolved answer is
   * what keeps the `Offer.url` below in step with the page's own canonical tag
   * and with the sitemap entry for the same product — three places that must
   * never disagree about a product's address.
   */
  shopUrl: string
  shopName?: string
  currency?: string
  locale?: string
}

/**
 * Server-rendered Schema.org JSON-LD for Google rich snippets.
 *
 * Emits standard `Product` and `Offer` schema structured data so crawlers
 * can index product pricing, stock availability, photos, and merchant identity.
 */
export function ProductJsonLd({
  product,
  shopUrl,
  shopName = "Shop",
  currency = "SAR",
  locale = "ar",
}: ProductJsonLdProps) {
  const name = text(product.name, locale, product.slug)
  const description =
    text(product.seo_description, locale) ||
    text(product.description, locale) ||
    name
  const mainImage = imageRef(product.image)?.original
  const galleryImages = imageRefs(product.gallery).map((img) => img.original)

  const images = Array.from(
    new Set([mainImage, ...galleryImages].filter((img): img is string => !!img)),
  )

  const canonicalUrl = `${shopUrl}/products/${product.slug}`
  const rawPrice = product.selling_price_cents ?? product.price_cents
  const price = typeof rawPrice === "number" ? (rawPrice / 100).toFixed(2) : undefined

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: {
      "@type": "Brand",
      name: product.brand || shopName,
    },
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            url: canonicalUrl,
            priceCurrency: currency,
            price,
            availability: product.in_stock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
