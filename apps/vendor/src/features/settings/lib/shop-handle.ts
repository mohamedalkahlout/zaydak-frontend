/**
 * The shop-handle rules, mirrored for the Domains pane.
 *
 * **A mirror, not the boundary.** `UpdateShopInput.slug` carries the pattern
 * and `ShopsService.assertHandleAllowed` refuses a reserved name; both run
 * whatever this file says. What this buys is the difference between a vendor
 * being told *as they type* and being told by a red toast after a dialog has
 * already closed over a handle they cannot have.
 *
 * The reserved list is the one thing worth keeping honest by hand, because it
 * is the only rule a vendor cannot infer from the input. See
 * `back-end/src/shops/lib/reserved-handles.ts` for why each group is on it.
 */

/** The server's own rule: `UpdateShopInput.slug`. */
export const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const MIN_HANDLE = 3
export const MAX_HANDLE = 60

/**
 * Handles the platform keeps.
 *
 * Mirrored from `back-end/src/shops/lib/reserved-handles.ts`. A stale copy here
 * costs one round trip and a server error, never a wrong outcome — the pane
 * also asks `isShopSlugAvailable`, which consults the real list, so a name this
 * file has not heard of still comes back unavailable.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Platform hosts and the apex's aliases.
  "www", "admin", "dash", "dashboard", "api", "app", "cdn", "assets",
  "static", "media", "files", "uploads", "img", "images",
  // Anything that reads as an auth or billing surface.
  "auth", "login", "signin", "sign-in", "signup", "sign-up", "register",
  "logout", "password", "verify", "oauth", "sso", "account", "accounts",
  "billing", "checkout", "pay", "payment", "payments", "invoice", "invoices",
  "secure",
  // Mail and DNS record names.
  "mail", "email", "smtp", "imap", "pop", "mx", "ns", "ns1", "ns2", "dns",
  "ftp", "vpn", "autodiscover", "autoconfig", "webmail", "exchange",
  "lyncdiscover", "sip", "enterpriseregistration", "enterpriseenrollment",
  "_domainkey", "dkim", "dmarc", "spf",
  // Company surfaces.
  "support", "help", "helpdesk", "docs", "documentation", "developers",
  "developer", "status", "blog", "news", "press", "about", "careers", "jobs",
  "legal", "privacy", "terms", "security", "contact", "partners",
  "affiliates", "community", "forum", "shop", "shops", "store", "stores",
  "marketplace", "platform", "zaydak",
  // Environments. `demo`, `test`, `beta` and `alpha` are deliberately absent —
  // they are ordinary trading names as often as they are environments.
  "staging", "stage", "dev", "development", "sandbox", "preview", "local",
  "localhost", "internal", "example",
])

/** Exact match only — `admin` is refused, `admin-supplies` is not. */
export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.trim().toLowerCase())
}

/** What the vendor types, made legal as they type it. */
export function normalizeHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, MAX_HANDLE)
}

/** Why a handle cannot be used, or null when the shape is fine. */
export type HandleProblem = "tooShort" | "malformed" | "reserved"

/**
 * Check the shape only. Availability is a server question and is asked
 * separately — a handle can be perfectly well-formed and already taken.
 */
export function handleProblem(handle: string): HandleProblem | null {
  const value = handle.trim()
  if (!value) return null
  if (value.length < MIN_HANDLE) return "tooShort"
  if (!HANDLE_PATTERN.test(value)) return "malformed"
  if (isReservedHandle(value)) return "reserved"
  return null
}

/**
 * The address a handle produces, as the customer will see it.
 *
 * With a platform apex configured a shop lives at `<handle>.<apex>`; without
 * one it lives at `<storefront-host>/<handle>`, which is what every existing
 * deployment does and what the pane showed before subdomains existed. The
 * preview has to match whichever is real, or it promises an address that does
 * not resolve.
 */
export function handlePreview(
  handle: string,
  storefrontHost: string,
  rootDomain: string | null,
): string {
  const value = handle || "…"
  return rootDomain ? `${value}.${rootDomain}` : `${storefrontHost}/${value}`
}
