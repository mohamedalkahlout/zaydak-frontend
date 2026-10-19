import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getLocale } from "next-intl/server"

import { STOREFRONT_PRODUCT } from "@/features/catalog/api"
import {
  ProductDetail,
  ProductDetailSkeleton,
} from "@/features/catalog/components/product-detail"
import { fetchProductMeta } from "@/features/catalog/lib/product-server"
import { ProductJsonLd } from "@/features/catalog/components/product-json-ld"
import { fetchShopShell } from "@/features/shop/lib/shop-server"
import { PreloadQuery, storefrontContext } from "@/shared/apollo/rsc"
import { resolveLocale } from "@/shared/i18n/config"
import { imageRef, text } from "@/shared/lib/multilang"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"

/**
 * Per-product document metadata.
 *
 * Until this existed the only `generateMetadata` in the app was the shop
 * layout's, so **every product in a store shared one title, one description and
 * one image** — the shop's. A link pasted into WhatsApp or a group chat showed
 * the storefront's name and cover for whichever mug or shirt it actually
 * pointed at, and search results carried the same. None of those crawlers run
 * JavaScript, so no amount of client rendering could have fixed it.
 *
 * `seo_title` / `seo_description` win where the vendor filled them in, because
 * that is what those fields are for; otherwise the product's own name and
 * description stand in. Both are multilang blobs, so they resolve through
 * `text()` against the request's locale rather than being printed raw.
 *
 * A read failure returns `{}` and the shop layout's metadata stands — a share
 * card is never worth taking a product page down for.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string; slug: string }>
}): Promise<Metadata> {
  const { shopSlug, slug } = await params
  const [product, shop, rawLocale] = await Promise.all([
    fetchProductMeta(shopSlug, slug),
    fetchShopShell(shopSlug),
    getLocale().catch(() => undefined),
  ])
  if (!product) return {}

  const base = await canonicalShopBase(shop?.slug ?? shopSlug)

  const locale = resolveLocale(rawLocale)
  const name = text(product.name, locale, product.slug)
  const title = text(product.seo_title, locale) || name
  const description =
    text(product.seo_description, locale) ||
    text(product.description, locale) ||
    undefined
  const image = imageRef(product.image)?.original

  return {
    title,
    description,
    alternates: {
      // The shop's own address, built from its CURRENT handle AND its
      // promoted domain: a canonical pointing at a URL that 307s or 308s is a
      // canonical pointing nowhere. Same rule, same helper, as the shop sitemap
      // that lists this page — the two would otherwise name different origins
      // for it.
      canonical: `${base}/products/${slug}`,
    },
    openGraph: {
      title,
      description,
      // `website`, not `product`: Next's typed `Metadata` has no `product` in
      // its `og:type` union, and the tags that actually build the card — title,
      // description, image — are the same either way.
      type: "website",
      ...(shop?.name ? { siteName: shop.name } : {}),
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

/**
 * One product, fetched before the page is written rather than after it loads.
 *
 * The `notFound()` is the other half of the SEO fix. `ProductDetail` has always
 * rendered a "no such product" panel, but it rendered it inside a **200**, and
 * a soft 404 is a page search engines keep in the index and keep sending people
 * to. `fetchProductMeta` is React-`cache()`d and `generateMetadata` above has
 * already called it for this request, so establishing that costs no extra round
 * trip.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ shopSlug: string; slug: string }>
}) {
  const { shopSlug, slug } = await params
  const [product, shop, rawLocale] = await Promise.all([
    fetchProductMeta(shopSlug, slug),
    fetchShopShell(shopSlug),
    getLocale().catch(() => undefined),
  ])
  if (!product) notFound()
  const locale = resolveLocale(rawLocale)
  const shopUrl = await canonicalShopBase(shop?.slug ?? shopSlug)

  return (
    <>
      <ProductJsonLd
        product={product}
        shopUrl={shopUrl}
        shopName={shop?.name}
        locale={locale}
      />
      <PreloadQuery
        query={STOREFRONT_PRODUCT}
        variables={{ slug }}
        context={await storefrontContext(shopSlug)}
      >
        <Suspense fallback={<ProductDetailSkeleton />}>
          <ProductDetail slug={slug} />
        </Suspense>
      </PreloadQuery>
    </>
  )
}
