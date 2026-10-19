import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SHOP_BY_SLUG } from "@/features/shop/api"
import { ShopShell } from "@/features/shop/components/shop-shell"
import { brandThemeCss } from "@/features/shop/lib/brand-theme"
import {
  fetchShopShell,
  fetchStorefrontPresentation,
} from "@/features/shop/lib/shop-server"
import { PreloadQuery, storefrontContext } from "@/shared/apollo/rsc"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"
import { publicPathname, serverTenant } from "@/shared/lib/tenant-server"
import { shopRelativePath, type TenantScope } from "@/shared/lib/tenant"

/**
 * Where a retired handle should send the visitor, keeping the page they asked for.
 *
 * `/old-handle/products/mug` becomes `/new-handle/products/mug`, so a shared
 * link lands on the page it named rather than being dumped on the shop home.
 *
 * **The two addresses need opposite treatment, and getting it wrong is silent.**
 * On the apex the handle is in the path, so the fix is a path rewrite and a
 * relative redirect. On a shop's own hostname the handle is the *host* — the
 * path never mentions it — so the same page at the new handle is on a
 * different origin, and a relative redirect would leave the visitor on
 * `old.zaydak.com` forever, looping. It has to be absolute.
 *
 * `pathname` is the PUBLIC path the proxy stamped, before its internal rewrite:
 * on a shop host that is `/products/mug`, not the `/old-handle/products/mug`
 * the route tree matched. Comparing the rewritten path against `params` here
 * would find the handle at the front of every request and redirect every
 * visitor to the shop home.
 */
async function canonicalPath(
  pathname: string | null,
  tenant: TenantScope,
  to: string,
): Promise<string> {
  const rest = shopRelativePath(pathname ?? "/", tenant)

  if (tenant.mode === "host") {
    // Cross-origin, so it must be absolute. `canonicalShopBase` resolves the
    // shop's own address — its promoted custom domain when it has one, its
    // platform subdomain otherwise, and the apex path form when no root domain
    // is configured, in which case this is the path-mode answer anyway.
    //
    // Resolving the custom domain here rather than letting the subdomain's own
    // 308 do it saves the visitor a second redirect on a hop that is already a
    // redirect, which is the difference between one round trip and two on every
    // link that still carries a retired handle.
    const base = await canonicalShopBase(to)
    return `${base}${rest === "/" ? "" : rest}` || "/"
  }

  return `/${to}${rest === "/" ? "" : rest}`
}

/**
 * Per-shop document metadata.
 *
 * Title is the shop's own name; the root layout's `%s | Zaydak` / `%s | زايدك`
 * template appends the platform brand. Description is the shop's description
 * or brand slogan — never a platform placeholder, so an empty shop does not
 * inherit invented marketing copy.
 *
 * The square logo is the icon: a wide logo rendered into a 32px favicon or a
 * circular avatar is a smear, which is the whole reason the Brand pane asks for
 * a second image. It falls back to the default logo, then to the app's own icon.
 *
 * A read failure returns no override rather than throwing — the storefront
 * keeps the app-level title, and a metadata problem never takes a page down.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}): Promise<Metadata> {
  const { shopSlug } = await params
  const shop = await fetchShopShell(shopSlug)
  if (!shop) return {}

  // The shop's OWN address, whichever one this request arrived on. A page
  // served at `acme.zaydak.com` that named the apex as canonical would be
  // telling crawlers its own domain is a duplicate of the marketplace's front
  // door; and `zaydak.com/acme` pointing at `acme.zaydak.com` is what collapses
  // the two live copies of every page into one indexed address.
  //
  // Built from the shop's CURRENT slug, not the one in the URL: a retired
  // handle redirects, and a canonical pointing at a redirect is a canonical
  // pointing nowhere. The promoted custom domain is the same rule one step
  // further on — `acme.zaydak.com` now 308s to `acme.com`, so naming the
  // subdomain here would be naming a redirect again.
  const base = await canonicalShopBase(shop.slug)

  const brand = shop.settings?.brand
  const icon =
    brand?.square_logo?.thumbnail ||
    brand?.square_logo?.original ||
    shop.logo?.thumbnail ||
    shop.logo?.original
  const share = shop.cover_image?.original || brand?.square_logo?.original
  const description = shop.description || brand?.slogan || undefined

  return {
    title: shop.name,
    description,
    alternates: { canonical: base },
    ...(icon ? { icons: { icon } } : {}),
    openGraph: {
      title: shop.name,
      description,
      type: "website",
      url: base,
      ...(share ? { images: [{ url: share }] } : {}),
    },
  }
}

/**
 * Every storefront route is shop-scoped, and the scope is the first segment of
 * the route tree. This layout is the only place that reads it out of `params`.
 * The browser's Apollo link derives `X-SHOP` from the address instead — the
 * path, the shop's own hostname, or on a custom domain the shop the proxy
 * resolved and the root layout wrote on `<html>` — each of which the proxy's
 * rewrite keeps equal to this segment.
 *
 * It reads the shop **twice, for two different jobs**, and both reads are on
 * the server. `fetchShopShell` is a cached six-field plain `fetch` for the
 * things that have to be decided before a single byte of HTML is written — the
 * document metadata and the brand colours, which cannot wait for a component to
 * render. `PreloadQuery` then starts the full `SHOP_BY_SLUG` that every screen
 * under here reads through `useShop()`, and streams the result into the browser
 * cache so `ShopProvider` resolves against it instead of opening its own
 * request. What used to be one server read plus one *browser* round trip is now
 * two server reads that overlap, and the shop's name, currency and prices are
 * in the HTML rather than arriving after hydration.
 */
export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const shop = await fetchShopShell(shopSlug)
  const presentation = await fetchStorefrontPresentation(shopSlug)
  const tenant = await serverTenant(shopSlug)

  // The visitor is holding a handle the shop used to answer to. `shop(slug)`
  // resolved it — that is what stops the 404 — and this puts the canonical
  // address in the URL bar so the old one does not linger as a second live
  // copy of every page.
  //
  // Temporary (307), not permanent: a handle can be changed again, or changed
  // back, and a 308 cached in every visitor's browser would outlive the
  // decision that caused it.
  if (shop && shop.slug !== shopSlug) {
    redirect(await canonicalPath(await publicPathname(), tenant, shop.slug))
  }

  const css = brandThemeCss(shop)

  return (
    <>
      {css && (
        <style
          // Built from a fixed set of `#RRGGBB`-validated values, never from
          // shop text — see `brandThemeCss`, which drops anything that is not
          // six hex digits rather than passing it through.
          dangerouslySetInnerHTML={{ __html: css }}
        />
      )}
      <PreloadQuery
        query={SHOP_BY_SLUG}
        variables={{ slug: shopSlug }}
        context={await storefrontContext(shopSlug)}
      >
        <ShopShell
          slug={shopSlug}
          base={tenant.base}
          mode={tenant.mode}
          storefrontTemplate={presentation?.template ?? null}
        >
          {children}
        </ShopShell>
      </PreloadQuery>
    </>
  )
}
