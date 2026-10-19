"use client"

import { usePathname } from "next/navigation"

import { documentHostShop } from "@/shared/lib/shop-scope"
import { resolveDocumentTenant, type TenantScope } from "@/shared/lib/tenant"

/**
 * The shop the current page belongs to, **reactively**.
 *
 * The React counterpart to `currentShopSlug()`. That one reads
 * `location.pathname` at the moment it is called, which is right for a request
 * going out and wrong for a component: it does not re-render when a visitor
 * walks from one storefront to another on the client, so a header reading it
 * would keep showing the previous shop's session.
 *
 * `usePathname()` is the same value from the router, which does.
 *
 * The **host** is read straight off `location` rather than from a hook, and
 * that is safe for the opposite reason: a client-side navigation cannot change
 * the hostname. Walking from one shop host to another is a full page load, so
 * there is nothing for a hook to observe — and reading it during render on the
 * server would be reading a host the server does not have. `usePathname()`
 * returns a value on the server render too, so the pair stays consistent: no
 * host means the path decides, which is the apex's behaviour anyway.
 *
 * The document's host shop (`documentHostShop`) is fixed for the same reason
 * the host is — see `HOST_SHOP_ATTRIBUTE` — and is what makes a merchant's own
 * domain resolve here at all. Without it `SessionSync` hydrated the auth store
 * for no shop on a custom domain, so a signed-in shopper read as a guest.
 */
export function useShopTenant(): TenantScope {
  const pathname =
    usePathname() ?? (typeof window === "undefined" ? "" : window.location.pathname)
  const host = typeof window === "undefined" ? null : window.location.host
  return resolveDocumentTenant(host, pathname, documentHostShop())
}

/**
 * Null on `/`, the shop directory — the one route with no scope.
 */
export function useShopSlug(): string | null {
  return useShopTenant().slug
}
