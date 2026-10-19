import Link from "next/link"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"

import { resolveHostScope } from "@/shared/lib/hostname"
import { marketplaceHref } from "@/shared/lib/site-url"
import { serverHostShop } from "@/shared/lib/tenant-server"

/**
 * The app-level 404.
 *
 * It is deliberately thin, because almost nothing reaches it: a bad shop slug
 * is caught by `ShopShell`, which renders the shop-closed screen *inside* the
 * storefront rather than throwing, and a bad product slug is caught by the PDP.
 * What lands here is a path that matches no route at all.
 */
export default async function NotFound() {
  const t = await getTranslations("common")
  const tShop = await getTranslations("shop")

  // Outside `ShopProvider`, so the host is read directly rather than taken
  // from the context. It matters here for the same reason it matters on the
  // closed-shop screen: on `acme.zaydak.com` a relative "/" is Acme's home,
  // and the one link on a 404 page should not land somewhere that can 404
  // again on the next click. A merchant's own domain is not a platform
  // subdomain, so the host string alone misses it — the proxy's verdict
  // (`serverHostShop`) is what says this host belongs to a shop.
  const onShopHost =
    resolveHostScope((await headers()).get("host")).kind === "tenant" ||
    (await serverHostShop()) !== null

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24 text-center">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {t("notFoundTitle")}
        </h1>
        <Link
          href={marketplaceHref(onShopHost ? "host" : "path")}
          className="mt-4 inline-block text-sm font-medium text-shop-accent hover:underline"
        >
          {tShop("browseAll")}
        </Link>
      </div>
    </main>
  )
}
