import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ContactPage } from "@/features/contact/components/contact-page"
import { fetchShopShell } from "@/features/shop/lib/shop-server"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"

/**
 * `/contact` is **public and crawlable**, and nothing had to be done to make it
 * so — which is the point worth writing down. `robots.ts` derives its disallow
 * list from `PRIVATE_SEGMENTS` and `GUEST_ONLY_SEGMENTS` plus `cart` and
 * `wishlist`, so a new segment is crawlable unless somebody adds it to one of
 * those lists. `contact` belongs in none of them: it needs no session, holds
 * nothing per-visitor, and is exactly the page a shopper searching for a way to
 * reach a shop should be able to find.
 *
 * The shop is not fetched for the body — `ShopProvider` above already holds it,
 * and `ShopShell` renders the closed-storefront screen instead of these
 * children when there is no shop. This read is only for the document head, and
 * it returns nothing rather than throwing when it fails: a metadata problem
 * must never be the reason a page 500s.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}): Promise<Metadata> {
  const { shopSlug } = await params
  const [shop, t] = await Promise.all([
    fetchShopShell(shopSlug),
    getTranslations("contact"),
  ])

  if (!shop) return {}

  const title = t("title", { shop: shop.name })

  return {
    title,
    description: t("subtitle", { shop: shop.name }),
    alternates: {
      // The shop's own address, built from its CURRENT handle — a retired
      // handle 308s and a promoted custom domain replaces the subdomain, so a
      // canonical built any other way names a redirect.
      canonical: `${await canonicalShopBase(shop.slug)}/contact`,
    },
  }
}

export default function Contact() {
  return <ContactPage />
}
