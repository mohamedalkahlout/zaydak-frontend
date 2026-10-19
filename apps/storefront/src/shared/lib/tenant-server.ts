import "server-only"

import { headers } from "next/headers"

import {
  PATHNAME_HEADER,
  TENANT_HOST_HEADER,
  TENANT_MODE_HEADER,
  TENANT_SLUG_HEADER,
} from "@/proxy"
import {
  hostPort,
  resolveHostScope,
  ROOT_DOMAIN,
  shopOrigin,
} from "./hostname"
import { hostTenant, NO_TENANT, pathTenant, type TenantScope } from "./tenant"
import { SITE_URL } from "./site-url"

/**
 * The request's shop scope, on the server.
 *
 * After the proxy's internal rewrite a request to `acme.zaydak.com/cart` and one
 * to `zaydak.com/acme/cart` arrive at the same route with the same
 * `params.shopSlug`, and they are **deliberately indistinguishable** — that is
 * what lets the whole route tree stay as it was. But three things still have to
 * differ, and all three are decided here:
 *
 *   - which prefix in-app links carry (`base`),
 *   - which absolute origin a canonical URL and an OG tag name,
 *   - which paths `robots.txt` tells crawlers to skip.
 *
 * So the proxy stamps the mode onto the request and this reads it back. The
 * slug still comes from `params` rather than a header: it is already there, it
 * is already the thing the route matched on, and a second source for the same
 * fact is a second thing that can disagree.
 *
 * A request that never passed through the proxy — a route excluded by the
 * matcher, or a direct render in a test — reads as path mode, which is the
 * behaviour this app had before any of this existed.
 */
export async function serverTenant(
  shopSlug: string | null,
): Promise<TenantScope> {
  if (!shopSlug) return NO_TENANT
  const mode = (await headers()).get(TENANT_MODE_HEADER)
  return mode === "host" ? hostTenant(shopSlug) : pathTenant(shopSlug)
}

/**
 * The shop this request's **hostname** was resolved to, for the root layout to
 * hand to the browser (`HOST_SHOP_ATTRIBUTE`). Null in path mode.
 *
 * The root layout is the one server component that has no `params.shopSlug`
 * to read, so this is the one place the slug comes off a header rather than
 * the route — and it is the same value the proxy rewrote into that segment.
 * Read only alongside host mode, because the proxy only ever sets the two
 * together: a slug without the mode is not something it said.
 */
export async function serverHostShop(): Promise<string | null> {
  const requestHeaders = await headers()
  if (requestHeaders.get(TENANT_MODE_HEADER) !== "host") return null
  return requestHeaders.get(TENANT_SLUG_HEADER) || null
}

/**
 * The public path of the current request, as the browser shows it.
 *
 * Stamped by the proxy before the rewrite, so on a shop host this is
 * `/products/mug` and not the `/acme/products/mug` the route tree matched.
 * That distinction is the whole reason the header exists: the layout uses it to
 * build a redirect **for the browser**, and the browser has never heard of the
 * slug segment.
 */
export async function publicPathname(): Promise<string | null> {
  return (await headers()).get(PATHNAME_HEADER)
}

/**
 * The absolute origin this request is being served from.
 *
 * `SITE_URL` is a `NEXT_PUBLIC_` constant, inlined at build time, and therefore
 * physically incapable of varying per request — which was fine when one origin
 * served every shop and is wrong now that `acme.zaydak.com` exists. A page
 * served there that named the apex as its canonical URL would be telling
 * crawlers that the shop's own domain is a duplicate of somebody else's front
 * door.
 *
 * Falls back to `SITE_URL` whenever the request did not arrive on a shop host,
 * which keeps every existing absolute URL byte-identical.
 */
export async function requestOrigin(): Promise<string> {
  const host = (await headers()).get(TENANT_HOST_HEADER)
  if (!host) return SITE_URL

  // Re-classified through the same function the proxy used rather than by
  // stripping the apex off the string here. A second parser for one format is
  // a second set of edge cases, and this one would be reading a header to
  // decide which origin a page claims as its own.
  const scope = resolveHostScope(host)
  if (scope.kind !== "tenant") return SITE_URL

  // `ROOT_DOMAIN`, not `CANONICAL_ROOT_DOMAIN`: this host demonstrably IS the
  // one being served, so there is nothing to opt into — unlike `shopUrlBase`,
  // which has to decide a shop's address with no request in hand.
  return shopOrigin(scope.slug, ROOT_DOMAIN, hostPort(host)) ?? SITE_URL
}

/**
 * **The canonical base moved.** It used to live here as `canonicalBase(tenant)`,
 * a pure wrapper over `shopUrlBase(tenant.slug)` — and it could be pure only for
 * as long as a shop's address was derivable from its handle. A promoted custom
 * domain is a row in the database, so the answer now needs a lookup and lives in
 * `shared/lib/shop-hostname.ts` as `canonicalShopBase(slug)`.
 *
 * Nothing forwards to it from here on purpose: two functions answering "what is
 * this shop's address?" is exactly how a page's canonical tag and the sitemap
 * that lists it start naming different origins.
 */
