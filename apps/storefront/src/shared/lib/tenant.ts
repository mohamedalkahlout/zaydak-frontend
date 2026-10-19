/**
 * The shop scope of one request, and the link prefix that follows from it.
 *
 * Two addresses now reach the same page:
 *
 *   zaydak.com/acme/products/blue-mug     "path mode"  — what this app has always done
 *   acme.zaydak.com/products/blue-mug     "host mode"  — the shop's own address
 *
 * Both render `app/[shopSlug]/products/[slug]/page.tsx`. In host mode the proxy
 * rewrites the path *internally* so the route tree, `params.shopSlug`,
 * `storefrontContext(slug)` and the `X-SHOP` header all keep working exactly as
 * they did — the browser never sees the slug, and nothing downstream had to
 * learn a new way to ask which shop it is serving.
 *
 * **`base` is the whole point of this module.** A link written
 * `` `/${slug}/cart` `` is correct in path mode and wrong in host mode, where
 * it would navigate to `acme.zaydak.com/acme/cart` — a path the proxy would
 * then rewrite to `/acme/acme/cart` and 404. Every in-app link is written
 * `` `${base}/cart` `` instead: `base` is `"/acme"` in path mode and `""` in
 * host mode, so one expression is right on both addresses and no call site has
 * to know which one it is on.
 */

import { parseShopPath } from "@/shared/auth/route-access"
import {
  CANONICAL_ROOT_DOMAIN,
  normalizeHostname,
  resolveHostScope,
  ROOT_DOMAIN,
} from "./hostname"

/**
 * The shop a request belongs to and how it got there.
 *
 * `slug` is null on exactly one route — `/`, the marketplace directory, which
 * has no shop and needs none.
 */
export interface TenantScope {
  /**
   * `"host"` when the shop came off the hostname, `"path"` when it came off
   * the first path segment. Not cosmetic: it decides `base`, which canonical
   * URL a page claims, and which paths `robots.txt` tells crawlers to skip.
   */
  mode: "path" | "host"
  slug: string | null
  /**
   * The prefix every in-app link starts with. `"/acme"` in path mode, `""` in
   * host mode, `""` on the directory.
   *
   * Never has a trailing slash, so `` `${base}/cart` `` is well-formed. The
   * shop home is **not** `` `${base}/` `` — that string is `/acme/` on the
   * apex, and `next/link` keeps the slash in SSR then strips it on the client,
   * which hydrates as a mismatch on the brand link. Use `shopHomeHref(base)`.
   */
  base: string
}

/**
 * The shop home as a `Link` href: `/acme` on the apex, `/` on a shop host.
 *
 * Host-mode `base` is `""`, so a bare `` `${base}` `` is not a link. The old
 * `` `${base}/` `` fixed that and broke hydration on the other address.
 */
export function shopHomeHref(base: string): string {
  return base || "/"
}

/** The directory at `/`: no shop, no prefix. */
export const NO_TENANT: TenantScope = { mode: "path", slug: null, base: "" }

/** The scope for a shop reached through its own hostname. */
export function hostTenant(slug: string): TenantScope {
  return { mode: "host", slug, base: "" }
}

/** The scope for a shop reached at `/{slug}` under the apex. */
export function pathTenant(slug: string): TenantScope {
  return { mode: "path", slug, base: `/${slug}` }
}

/**
 * Whether this host is one whose **path** is allowed to name a shop.
 *
 * The path fallback is what makes `zaydak.com/acme/products/mug` work, and for
 * a long time it ran for *every* host the apex check did not claim. That is one
 * step too generous, and the step is a security one: an unknown hostname
 * pointed at this deployment — a domain somebody parked on our IP, an
 * unverified domain a merchant added DNS for and never completed, a forged
 * `Host` header — served `/acme/checkout` as **Acme's** checkout. Reading the
 * shop out of the path is exactly what it should not do there, because the host
 * has no standing to speak for Acme and the address bar says so.
 *
 * So the path may name a shop only on a host that is demonstrably ours:
 *
 *   - the configured apex itself, and anything under it (a reserved label like
 *     `www`, or a multi-label name that is not a handle) — the apex is the
 *     marketplace and `zaydak.com/acme` is its own browsing surface;
 *   - a development or health-check host — `localhost`, `*.localhost`, a bare
 *     IPv4 address, a bracketed IPv6 literal. `worthResolving` in
 *     `domain-request.ts` draws the same line for the same reason;
 *   - **any** host at all when no apex is configured, which is the escape hatch
 *     that matters: `ROOT_DOMAIN` defaults to `localhost`, so a deployment that
 *     never set `NEXT_PUBLIC_ROOT_DOMAIN` cannot tell its own apex from a
 *     stranger's host, and tightening there would take the whole storefront
 *     off the air rather than tightening anything. Host mode is opt-in and so
 *     is this.
 *
 * A missing `Host` is permitted and an **unreadable** one is not, which is the
 * one asymmetry worth spelling out. No header at all means the request did not
 * come from a browser — a direct render, an internal fetch, a test — and HTTP
 * gives an attacker no way to produce it. A header that is present and refuses
 * to parse is the opposite: it is precisely the shape used to make two parsers
 * disagree about where a hostname ends.
 *
 * A custom merchant domain is **not** on this list and must not be: it is not
 * readable from the string, so it is resolved by `proxy.ts` from the back-end's
 * verdict instead, which names the shop outright and never consults the path.
 */
export function hostServesPathTenants(
  host: string | null | undefined,
  rootDomain: string | null = CANONICAL_ROOT_DOMAIN,
): boolean {
  // No apex configured: host mode is switched off and every request behaves
  // exactly as it did before shop hostnames existed.
  if (!rootDomain) return true

  // No `Host` header at all. Nothing to classify, and nothing to exploit.
  if (host === null || host === undefined || host.trim() === "") return true

  const hostname = normalizeHostname(host)
  if (!hostname) return false

  if (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)) return true

  // Development and health checks.
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true
  if (hostname.startsWith("[")) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true

  return false
}

/**
 * Work out the scope from a host and a **public** path.
 *
 * "Public" means the path as the browser shows it — before any rewrite. That
 * is what `proxy.ts` holds, and what `window.location.pathname` holds; it is
 * *not* what a server component's `params` holds in host mode, which is why
 * the RSC tree is handed the answer rather than recomputing it.
 *
 * A reserved label (`www`, `admin`) resolves as the apex on purpose: the label
 * is not a shop, so the path is the only thing left that could name one, and
 * `www.zaydak.com/acme` should serve Acme rather than nothing.
 *
 * **An unknown host gets no tenant at all**, rather than whatever its path
 * happens to spell — see `hostServesPathTenants`. The apex is untouched by
 * that: every address that worked on `zaydak.com` before still resolves to
 * exactly the same scope.
 *
 * `rootDomain` is the apex to resolve against. Omitted, it reads the
 * configuration: `ROOT_DOMAIN` to classify the host (its `localhost` default is
 * what makes `demo.localhost:3003` work with no env file) and
 * `CANONICAL_ROOT_DOMAIN` to decide whether an apex was *configured* at all,
 * since only that one is null when nobody opted in. Passing a value — which the
 * tests do — says both at once.
 */
export function resolveTenant(
  host: string | null | undefined,
  pathname: string,
  rootDomain?: string | null,
): TenantScope {
  const explicit = rootDomain !== undefined
  const scope = explicit
    ? resolveHostScope(host, rootDomain)
    : resolveHostScope(host, ROOT_DOMAIN)

  if (scope.kind === "tenant") return hostTenant(scope.slug)

  const apex = explicit ? rootDomain : CANONICAL_ROOT_DOMAIN
  if (!hostServesPathTenants(host, apex)) return NO_TENANT

  const slug = parseShopPath(pathname).shopSlug
  return slug ? pathTenant(slug) : NO_TENANT
}

/**
 * The `<html>` attribute naming the shop a **host-mode** document was rendered
 * for: `<html data-host-shop="nike">`. Absent in path mode and on the directory.
 *
 * It exists for the one address `resolveTenant` cannot read: a merchant's own
 * domain. `nikestore.com` carries no handle, so the host string resolves to no
 * shop (`hostServesPathTenants` says no), and the proxy names the shop from the
 * back-end's `domainRequest` verdict instead. That verdict reached the server
 * tree through the rewrite and never reached the browser, so every client-side
 * operation on a custom domain went out with **no `X-SHOP`** and was refused
 * with `MISSING_SHOP_HEADER`, while the server-rendered half of the same page
 * worked. The root layout writes the proxy's answer here and the browser
 * resolver reads it back (`resolveDocumentTenant`).
 *
 * **Why this is not the ambient "current shop" the rest of this app forbids.**
 * That ban is about the server, where a module is shared by every request in
 * flight. This value lives in one visitor's document, and it cannot lag a route
 * change the way a store could: a host-mode document never changes shop. Every
 * client-side navigation stays on the same host, and on that host the proxy
 * rewrites every path under the same shop — leaving it is a full page load,
 * which renders a new `<html>`.
 */
export const HOST_SHOP_ATTRIBUTE = "data-host-shop"

/**
 * The browser's scope: `resolveTenant`, plus the shop the proxy named for this
 * document when the host string could not.
 *
 * The precedence is the proxy's own, step for step: a host that names a shop
 * by reading wins; otherwise the verdict the proxy looked up (here, handed over
 * as `hostShop`) makes the request host-mode; only when there is neither does
 * the path decide. Mirroring it is what makes the browser send the same
 * `X-SHOP` the server rendered the page with.
 *
 * `hostShop` also covers a deployment whose client bundle has no apex
 * configured: there a platform subdomain is unreadable too, and the path would
 * otherwise be read as the shop (`/products/mug` as a shop called `products`).
 */
export function resolveDocumentTenant(
  host: string | null | undefined,
  pathname: string,
  hostShop: string | null | undefined,
  rootDomain?: string | null,
): TenantScope {
  const tenant = resolveTenant(host, pathname, rootDomain)
  if (tenant.mode === "host" || !hostShop) return tenant
  return hostTenant(hostShop)
}

/**
 * Strip the tenant prefix off a public path, giving the path *within* the shop.
 *
 * `/acme/products/mug` → `/products/mug` in path mode; `/products/mug` is
 * already shop-relative in host mode and comes back unchanged. The shop home
 * is `"/"` in both.
 */
export function shopRelativePath(
  pathname: string,
  tenant: TenantScope,
): string {
  if (!tenant.base) return pathname || "/"
  if (pathname === tenant.base) return "/"
  if (pathname.startsWith(`${tenant.base}/`)) {
    return pathname.slice(tenant.base.length) || "/"
  }
  return pathname || "/"
}

/**
 * The product a shop-relative path is showing, or null if it is not a product.
 *
 * `/products/blue-mug` → `blue-mug`; the catalogue index `/products` and
 * everything else → null. It exists so the assistant panel can tell the
 * back-end which product the shopper is standing on — a floating window over a
 * page that could not see the page was asking people which item they meant,
 * and taking a URL slug pasted by hand as the answer.
 *
 * Path-derived rather than passed down from the route, because the panel is
 * mounted in the shop layout and is deliberately not re-rendered per page.
 */
export function productSlugFromPath(shopRelative: string): string | null {
  const match = /^\/products\/([^/?#]+)/.exec(shopRelative)
  const slug = match?.[1]
  if (!slug) return null
  return decodeURIComponent(slug)
}

/**
 * The internal route a public path maps to: always the `/[shopSlug]/…` form.
 *
 * This is what `proxy.ts` rewrites to. In path mode the path already *is* the
 * internal form and is returned untouched, which is what keeps the rewrite a
 * no-op for every address that worked before this existed.
 */
export function internalPath(pathname: string, tenant: TenantScope): string {
  if (tenant.mode !== "host" || !tenant.slug) return pathname
  const rest = pathname === "/" ? "" : pathname
  return `/${tenant.slug}${rest}`
}
