import {
  HOST_SHOP_ATTRIBUTE,
  NO_TENANT,
  resolveDocumentTenant,
  type TenantScope,
} from "@/shared/lib/tenant"

/**
 * Which shop the current page belongs to, **in the browser**.
 *
 * The vendor dashboard keeps this in an `active-shop` Zustand store because a
 * vendor owns several shops and *chooses* between them. Here there is nothing to
 * choose: **the address is the scope.** `/acme/products/blue-mug` is Acme's mug
 * and cannot be anything else, so deriving it at the moment a request goes out
 * is not a shortcut — it is the single source of truth, and it removes a whole
 * class of bug where a store lags a route change and one query goes out scoped
 * to the shop the visitor just left.
 *
 * **The address is the host as well as the path.** A storefront answers at
 * three kinds of URL and the shop is read from whichever one carries it:
 *
 *     zaydak.com/acme/products/blue-mug     the slug is the first path segment
 *     acme.zaydak.com/products/blue-mug     the slug is the hostname label
 *     nikestore.com/products/blue-mug       the slug is in neither
 *
 * Reading only the path was not merely incomplete on the second address, it was
 * actively wrong: `parseShopPath("/products/blue-mug")` answers `products`,
 * which would go out as `X-SHOP: products` and name a cookie
 * `shop_products_access_token`. `resolveTenant` reads the host first for that
 * reason.
 *
 * The third address — a merchant's own domain — cannot be read at all: the
 * proxy looks it up (`domainRequest`) and the root layout writes the answer on
 * `<html>` (`HOST_SHOP_ATTRIBUTE`). Before that, this function returned no shop
 * there, and every browser query on a custom domain went out without `X-SHOP`.
 *
 * **There is deliberately no server-side equivalent, and no way to set one.**
 * This module used to carry a `setShopSlugOverride` for "any future server-side
 * fetch"; the override was a module-level variable, and a module is shared by
 * every request in flight in a Node process. Setting it for one visitor's
 * request and then awaiting anything hands that scope to whatever else renders
 * in the gap — the failure is one shop's page served with another shop's
 * `X-SHOP`, intermittently and only under concurrency, which is close to the
 * worst shape a bug can have.
 *
 * Server-side reads pass the slug explicitly instead: every server component
 * under `/[shopSlug]` already has it from `params` — which the proxy's internal
 * rewrite keeps true on a shop host too — and `storefrontContext(slug)`
 * (`shared/apollo/rsc.ts`) puts it on that one request. An argument cannot leak
 * into a neighbouring request.
 */

/**
 * The shop the proxy resolved this document's **hostname** to, or null.
 *
 * Read from the attribute the root layout rendered, so it is present from the
 * first byte of HTML — before hydration, before any query — and it is the
 * document's own, not something a module holds. Null on the server, in path
 * mode, and on the directory.
 */
export function documentHostShop(): string | null {
  if (typeof document === "undefined") return null
  return document.documentElement.getAttribute(HOST_SHOP_ATTRIBUTE) || null
}

/**
 * The full scope — slug, mode and link prefix — for the page in the address bar.
 *
 * Null-shop on the server by construction (see above) and on `/`, the shop
 * directory, which has no scope and needs none.
 */
export function currentTenant(): TenantScope {
  if (typeof window === "undefined") return NO_TENANT
  return resolveDocumentTenant(
    window.location.host,
    window.location.pathname,
    documentHostShop(),
  )
}

/**
 * The slug the next browser GraphQL operation should be scoped to.
 *
 * Null on the server by construction — see above — and null on `/`, the shop
 * directory, which has no scope and needs none.
 */
export function currentShopSlug(): string | null {
  return currentTenant().slug
}

/**
 * An in-app path for a **named** shop, correct at whichever address we are on.
 *
 * The counterpart to `useShop().base` for code that runs outside React and is
 * handed a slug rather than reading the current one: the Apollo error link
 * signing a rejected session out, `forceLogout`, the receipt uploader. Each of
 * those knows which shop the failing operation belonged to, which is not
 * necessarily the shop in the address bar — the whole reason the slug is an
 * argument there.
 *
 * The prefix is dropped only when this **is** the shop whose hostname we are
 * on — a platform subdomain or a custom domain alike. Anywhere else the path
 * form is used, which is always right on the apex and is the only thing that
 * could be right for a shop that is not this host's. In practice the mismatch
 * cannot arise on a shop host — `X-SHOP` is derived from the host, so an
 * operation there always belongs to it — but expressing the rule rather than
 * assuming the invariant costs one comparison.
 *
 * `path` must start with `/`. The shop home is `"/"`, which yields `"/"` on the
 * shop's own host and `"/acme/"` on the apex — never the empty string, which
 * is not a link.
 */
export function shopPathFor(slug: string | null, path = "/"): string {
  if (!slug) return "/"
  const tenant = currentTenant()
  const base = tenant.mode === "host" && tenant.slug === slug ? "" : `/${slug}`
  return `${base}${path}`
}
