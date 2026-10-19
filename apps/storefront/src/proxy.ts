import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  LEGACY_SESSION_COOKIES,
  accessCookie,
  sessionCookieNames,
} from "@/shared/auth/cookie-names"
import { routeDecision } from "@/shared/auth/route-access"
import {
  hostServesPathTenants,
  hostTenant,
  internalPath,
  resolveTenant,
  type TenantScope,
} from "@/shared/lib/tenant"
import {
  resolveDomainRequest,
  worthResolving,
  type DomainVerdict,
} from "@/shared/lib/domain-request"

/**
 * Route guard **and** tenant resolution. The decisions themselves live in
 * `routeDecision` and `resolveTenant` so they can be tested without a request
 * object; this file only translates them into a `NextResponse`.
 *
 * Resolving the tenant here is not a convenience — it is the only place that
 * works. The guard has to read the access cookie *named for the shop* before it
 * can decide whether `/checkout` is gated, so a lookup any later than this
 * leaves the guard blind; and the rewrite that maps a shop's own hostname onto
 * the `/[shopSlug]/…` route tree has to happen before routing, which is this.
 */

/**
 * The request path, forwarded into the server tree.
 *
 * A server layout is handed only its own dynamic params, and
 * `[shopSlug]/layout.tsx` needs the whole path to send a retired handle to the
 * current one **without dropping the page the visitor actually asked for** —
 * `/old/products/mug` has to land on `/new/products/mug`, not on `/new`.
 * Middleware is the only place that sees both.
 *
 * It carries the **public** path, before any rewrite. On a shop's own host
 * that is `/products/mug` and not the `/acme/products/mug` the route tree sees,
 * which is exactly what the layout needs: it is building an address for the
 * browser, and the browser has never heard of the slug segment.
 */
export const PATHNAME_HEADER = "x-storefront-pathname"

/**
 * How the shop was identified: `host` or `path`.
 *
 * The server tree cannot work this out for itself. After the rewrite below, a
 * request to `acme.zaydak.com/cart` and one to `zaydak.com/acme/cart` arrive at
 * the same route with the same `params.shopSlug`, and they are indistinguishable
 * — which is the whole point, except for the three things that must differ:
 * which prefix in-app links carry, which absolute origin a canonical URL names,
 * and which paths `robots.txt` tells crawlers to skip.
 */
export const TENANT_MODE_HEADER = "x-storefront-tenant-mode"

/**
 * The shop's own hostname, when the request came in on one.
 *
 * Absent on the apex. Read by the metadata layer so a page served at
 * `acme.zaydak.com` claims that origin as canonical rather than the apex's.
 */
export const TENANT_HOST_HEADER = "x-storefront-tenant-host"

/**
 * The shop a host-mode request resolved to. Absent in path mode.
 *
 * Read by exactly one thing: the root layout, which is the one server component
 * with no `params.shopSlug` and the one that renders `<html>`, where the
 * browser picks it up (`HOST_SHOP_ATTRIBUTE`). Everything under `/[shopSlug]`
 * keeps reading the slug from `params` — and cannot disagree with this, because
 * the rewrite below puts this same value in that segment.
 *
 * It is the only way the browser learns which shop a **custom domain** serves.
 * The host string cannot say, the verdict that does is looked up here, and
 * without this header it stopped at the rewrite: the server-rendered half of a
 * page on `nikestore.com` was Nike's, and every query the browser sent from it
 * went out with no `X-SHOP` at all.
 */
export const TENANT_SLUG_HEADER = "x-storefront-tenant-slug"

/**
 * Stamp the resolved scope onto the request headers, and rewrite when the shop
 * came off the hostname.
 *
 * The rewrite is **internal**: `acme.zaydak.com/products/mug` is served by
 * `/acme/products/mug` while the address bar keeps showing the shop's own URL.
 * That is what lets the entire route tree, `params.shopSlug`,
 * `storefrontContext(slug)` and the `X-SHOP` header stay exactly as they were —
 * nothing downstream had to learn a second way of asking which shop it is on.
 *
 * In path mode `internalPath` returns the path unchanged and this degrades to
 * the `NextResponse.next()` it always was, which is what keeps every URL that
 * worked before this feature working after it.
 */
function withTenant(request: NextRequest, tenant: TenantScope): NextResponse {
  const headers = new Headers(request.headers)
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname)
  headers.set(TENANT_MODE_HEADER, tenant.mode)
  if (tenant.mode === "host" && tenant.slug) {
    // The same string the tenant was resolved FROM, not `nextUrl.host`. The two
    // are normally equal, and a deployment where they are not is exactly the
    // one where a canonical URL built from the second would name a different
    // origin than the shop the request was scoped to.
    headers.set(TENANT_HOST_HEADER, request.headers.get("host") ?? "")
    headers.set(TENANT_SLUG_HEADER, tenant.slug)
  } else {
    // These two are the proxy's to say. `headers` started as a copy of the
    // inbound request, so a client sending its own would otherwise have it
    // passed through to the server tree as though this file had set it.
    headers.delete(TENANT_HOST_HEADER)
    headers.delete(TENANT_SLUG_HEADER)
  }

  const target = internalPath(request.nextUrl.pathname, tenant)
  if (target === request.nextUrl.pathname) {
    return NextResponse.next({ request: { headers } })
  }

  // `nextUrl.clone()` rather than a fresh URL: the search string, and the
  // internal routing state Next hangs off this object, both have to survive.
  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.rewrite(url, { request: { headers } })
}

/**
 * Send a visitor from an address the shop no longer uses to the one it does.
 *
 * **308 rather than 301 or 302.** A permanent redirect tells a crawler the
 * primary domain is the real address — which is the whole point of promoting
 * one — and the `8` is what preserves the method and body, so a POST arriving
 * at a retired address is not silently downgraded to a GET. A merchant who
 * promotes a domain should not lose form submissions in flight.
 *
 * **The path and query survive intact.** A redirect that lands everybody on the
 * shop's home page throws away the one thing the visitor asked for, and it
 * throws away campaign tracking with it: `?ref=ad` is how the merchant knows
 * where the visit came from, and an advert that resolves to an untracked home
 * page is money spent invisibly.
 *
 * **Loop safety is checked here too, even though the back-end guarantees it.**
 * `resolveDomainRequest` never returns a destination equal to the host it was
 * asked about, and `parse` drops one that somehow is. This is the third check,
 * and it earns its place by what it prevents: every other bug in this file
 * shows a wrong page, while this one shows nothing at all — a browser stops on
 * a redirect loop with no content and no way back.
 */
function redirectToPrimary(
  request: NextRequest,
  verdict: DomainVerdict | null,
): NextResponse | null {
  if (verdict?.action !== "REDIRECT" || !verdict.primaryHostname) return null

  const current = (request.headers.get("host") ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
  if (current === verdict.primaryHostname) return null

  const url = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    `https://${verdict.primaryHostname}`,
  )
  return NextResponse.redirect(url, 308)
}

/**
 * Refuse a shop page on a hostname that names no shop.
 *
 * `resolveTenant` no longer reads the shop out of the path on a host that is
 * not ours (`hostServesPathTenants`), and the verdict lookup above is the only
 * other thing that could have named one. When neither did, the request is for
 * somebody's storefront on an address with no claim to it — a parked domain
 * pointed at our IP, an unverified one a merchant set DNS for and abandoned,
 * a forged `Host`.
 *
 * **It has to be said here, because "no tenant" is not self-enforcing.** The
 * rewrite is what carries the scope, and with no tenant there is nothing to
 * rewrite: `internalPath` returns the path untouched, Next matches
 * `/acme/checkout` against the `[shopSlug]` tree exactly as it would on the
 * apex, and Acme's checkout is served from `parked.example` anyway — with the
 * route guard now reading `shopSlug: null` and gating nothing. Declining to
 * resolve a tenant without also declining to serve would have made the hole
 * slightly worse rather than closing it.
 *
 * **The root is deliberately exempt.** `/` on an unknown host is the
 * marketplace directory, which is public, names no shop and is what a load
 * balancer's health check asks for. Only a shop-shaped path is refused, so an
 * unrecognised host keeps answering the one request that is not about a shop.
 *
 * 204-shaped 404 rather than the styled not-found page: nothing here is a
 * visitor who took a wrong turn, and rendering a shop's chrome would mean
 * resolving a shop first.
 */
function unknownHost(
  request: NextRequest,
  tenant: TenantScope,
): NextResponse | null {
  if (tenant.slug) return null
  if (request.nextUrl.pathname === "/") return null
  if (hostServesPathTenants(request.headers.get("host"))) return null
  return new NextResponse(null, { status: 404 })
}

/**
 * Drop one shop's session cookies. No `path` argument needed: the scope is in
 * the cookie name and everything stays at `path=/`, which is what lets these
 * be deleted from here, from `/api/auth/*`, and from client JS alike.
 */
function clearSession(response: NextResponse, slug: string): NextResponse {
  for (const name of sessionCookieNames(slug)) response.cookies.delete(name)
  return response
}

/**
 * The four flat names this app wrote before sessions were per-shop.
 *
 * Swept on sight rather than read: a token minted before the back-end shipped
 * its half carries no `shop_id` claim, so adopting one would write a
 * shop-scoped credential from a session the server never scoped. Without this
 * the dead jar rides on every request for seven days.
 */
function sweepLegacy(request: NextRequest, response: NextResponse): NextResponse {
  if (LEGACY_SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    for (const name of LEGACY_SESSION_COOKIES) response.cookies.delete(name)
  }
  return response
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")

  // The hostname decides first; the path is the fallback. A shop reached at
  // its own address must not have the first segment of `/checkout` read as a
  // shop handle — see `shared/lib/tenant.ts`.
  let tenant = resolveTenant(host, request.nextUrl.pathname)

  // Two questions the host string cannot answer, asked in one call.
  //
  // **Which shop** — a merchant's own domain is whatever the database says, so
  // `nike.com` has to be looked up. **And whether this is still the address the
  // shop uses** — which is new, and is why a platform subdomain now reaches the
  // network at all: `acme.<root>` resolves to the `acme` shop by reading, but
  // the merchant may have connected `acme.com` and promoted it since, and
  // nothing in the hostname says so.
  //
  // The tenant resolution above stays pure and untouched. Only the redirect
  // verdict is looked up, and only here — the server tree never asks.
  const verdict = worthResolving(host ?? "")
    ? await resolveDomainRequest(host)
    : null

  // **The host wins whenever it names a shop, whatever the path says.**
  //
  // The guard this replaced only asked when the path had produced no slug,
  // which is true for `/` and nothing else — `parseShopPath` returns the first
  // segment of every other path. So `nike.com/` resolved correctly and
  // `nike.com/products/mug` was served as a shop called `products`: a 404 on
  // every page but the home page, and `nike.com/beta/checkout` scoped to
  // somebody else's storefront entirely.
  //
  // That has been latent since custom domains shipped. What made it urgent is
  // the redirect above it, which takes traffic off the platform subdomain — the
  // address that worked — and points it permanently at the one that did not.
  if (tenant.mode !== "host" && verdict?.slug) {
    tenant = hostTenant(verdict.slug)
  }

  const bounce = redirectToPrimary(request, verdict)
  if (bounce) return sweepLegacy(request, bounce)

  const stranger = unknownHost(request, tenant)
  if (stranger) return stranger

  const decision = routeDecision({
    pathname: request.nextUrl.pathname,
    shopSlug: tenant.slug,
    base: tenant.base,
    // The cookie named for *this* shop. A session at another storefront is
    // indistinguishable from no session here, which is exactly the behaviour
    // wanted: `/beta` shows a sign-in form rather than pretending.
    token: tenant.slug
      ? request.cookies.get(accessCookie(tenant.slug))?.value
      : undefined,
    expired: request.nextUrl.searchParams.has("expired"),
    redirect: request.nextUrl.searchParams.get("redirect"),
  })

  switch (decision.type) {
    case "clear":
      return sweepLegacy(
        request,
        tenant.slug
          ? clearSession(withTenant(request, tenant), tenant.slug)
          : withTenant(request, tenant),
      )
    case "redirect": {
      // Relative to the request's own URL, so a redirect issued on
      // `acme.zaydak.com` lands on `acme.zaydak.com` — `decision.to` is
      // already written in that host's vocabulary (no slug segment) because
      // `routeDecision` built it from `tenant.base`.
      const response = NextResponse.redirect(new URL(decision.to, request.url))
      return sweepLegacy(
        request,
        decision.clearCookies && tenant.slug
          ? clearSession(response, tenant.slug)
          : response,
      )
    }
    case "next":
      return sweepLegacy(request, withTenant(request, tenant))
  }
}

/**
 * Unlike the consoles, this matcher is a **negative** list.
 *
 * The consoles enumerate their private routes, and a route missing from the
 * list simply renders for a logged-out visitor — a bug, but a contained one.
 * Here the shop slug is a dynamic segment, so there is no finite list of paths
 * to enumerate: `/acme/checkout` and `/beta-store/checkout` are different URLs
 * and new shops appear without a deploy. Matching everything except the static
 * asset paths, and letting `routeDecision` read the section out of the URL, is
 * what makes the guard hold for a shop that did not exist when this shipped.
 *
 * Unchanged by per-shop sessions: the auth handlers stay at the app root, so
 * the existing `(?!api|…)` lookahead already excludes them and there is nothing
 * new to add. Still no JWT decoding either — the cookie's *name* carries the
 * shop, so the guard learns the scope without reading the token.
 *
 * **`/monitoring` is excluded with `api`.** Sentry's ingest tunnel lives there
 * so the browser can report without being blocked; a shop-host rewrite of
 * `/monitoring` to `/acme/monitoring` would 404 every event.
 *
 * **`sitemap.xml` is listed a second time, on purpose.** The `.*\.\w+$` clause
 * excludes every path with a file extension, so without the extra entry
 * `acme.zaydak.com/sitemap.xml` would fall through to `app/sitemap.ts` and
 * serve the WHOLE marketplace — every other shop's URLs, on a host that has no
 * business claiming them. Routed through the rewrite it lands on
 * `app/[shopSlug]/sitemap.xml/route.ts` instead, which already exists and
 * already emits exactly one shop. On the apex the rewrite is a no-op and
 * `/sitemap.xml` keeps serving the marketplace index.
 *
 * `robots.txt` stays excluded. It has to answer differently per host too, but
 * it reads the `Host` header itself (`app/robots.ts`) — routing it through the
 * rewrite would only give it a path it does not use.
 *
 * **`api` being excluded is load-bearing for domain verification, and it is not
 * obvious.** The back-end proves a custom domain is really being served by
 * fetching `https://<hostname>/api/domain-probe` with `redirect: "manual"`, so
 * a redirect there counts as a failure. An alias domain redirects — that is its
 * whole job — so if this matcher ever grew to cover `/api/*`, every alias would
 * fail its probe, and the nightly sweep would demote each of them after two
 * passes. Nothing would point at this file. The exclusion predates redirects
 * and keeps them working by accident; `proxy.redirect.test.ts` pins it on
 * purpose.
 */
export const config = {
  matcher: [
    "/((?!api|monitoring|_next/static|_next/image|fonts|favicon.ico|.*\\.\\w+$).*)",
    "/sitemap.xml",
  ],
}
