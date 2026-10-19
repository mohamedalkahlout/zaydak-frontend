/**
 * The storefront's route guard, as a pure function.
 *
 * It is inverted relative to the two consoles. There, everything is private and
 * a short list of paths is public; here **everything is public** — browsing a
 * shop, reading a product, filling a cart — and a short list of paths needs a
 * session. Getting that the wrong way round would put a login wall in front of
 * a catalogue, which is the one thing a storefront must never do.
 *
 * There is also **no role gate**. The admin console refuses a vendor's token
 * because a vendor has no console to use; here any signed-in account can shop,
 * and the back-end agrees — `createOrder` is `JwtAuthGuard` + `X-SHOP` with no
 * permission check on it. A vendor buying from another vendor's shop is an
 * ordinary customer.
 *
 * Like the consoles' guards this never verifies the token signature, so it is a
 * UX guard, not a security boundary: the back-end authorizes every operation.
 *
 * That distinction matters more now that a session belongs to one shop. What
 * this guard reads is the access cookie **named for the resolved shop**, so
 * `/beta` finds nothing when the visitor is only signed in at `/acme` and shows
 * them a sign-in form. The boundary is elsewhere: the access token carries a
 * `shop_id` claim, and `ShopHeaderGuard` on the back-end refuses it against any
 * other shop. Renaming a cookie stops nobody.
 *
 * **The shop is now passed in, not parsed out.** A storefront is reachable at
 * two addresses — `zaydak.com/acme/checkout` and `acme.zaydak.com/checkout` —
 * and on the second one the first path segment is a *section*, not a shop.
 * Left to parse the path itself this guard would read `checkout` as the shop,
 * find `section` empty, and conclude the page is public: the checkout screen
 * would stop being gated, silently, with no test failing and nothing in the
 * logs. So `proxy.ts` resolves the scope once (`shared/lib/tenant.ts`) and
 * hands down both the slug and the `base` every redirect is built from.
 */

/**
 * Path segments that require a session, relative to `/[shopSlug]/`.
 *
 * **`wishlist` is deliberately not among them, for the same reason `cart` never
 * was.** Both are lists a visitor builds before they have an account:
 * `WishlistButton` saves signed-out into `localStorage` and `adoptGuestWishlist`
 * moves it onto the account at sign-in. Gating the page would let somebody save
 * items and then bounce them to a login screen when they went to look at what
 * they had saved — the feature working and its own page refusing to show it.
 *
 * `checkout` and `account` stay: `createOrder` is `JwtAuthGuard`, so checkout
 * genuinely cannot proceed without a session, and the account hub has nothing
 * to render without one.
 */
export const PRIVATE_SEGMENTS = ["checkout", "account"] as const

/** Path segments under `/[shopSlug]/` that a signed-in customer is bounced off. */
export const GUEST_ONLY_SEGMENTS = [
  "login",
  "register",
  "forgot-password",
  "reset-password",
] as const

export interface ShopPath {
  /** The `[shopSlug]` segment, or null on a path with no shop in it at all. */
  shopSlug: string | null
  /** The segment straight after the slug (`""` for the shop home). */
  section: string
}

/**
 * Split `/acme/products/blue-mug` into `{ shopSlug: "acme", section: "products" }`.
 *
 * Every storefront URL is shop-scoped by construction, so the first segment is
 * the slug and the second is what the visitor is doing. The root `/` has no
 * shop and belongs to the shop-picker landing page.
 */
export function parseShopPath(pathname: string): ShopPath {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return { shopSlug: null, section: "" }
  return { shopSlug: parts[0]!, section: parts[1] ?? "" }
}

/**
 * A same-origin path that belongs to this shop.
 *
 * Shared so this module and `safeRedirect` cannot drift on what counts as safe.
 * `//evil.example` and `/\evil.example` both start with `/` and are absolute to
 * a browser, so a bare `startsWith("/")` is an open redirect.
 *
 * Takes the tenant's `base` rather than its slug, because the two addresses
 * spell the same destination differently: `/acme/checkout` under the apex and
 * `/checkout` on the shop's own host. On a shop host every same-origin path is
 * within the shop by construction — the host *is* the scope — so `base` is
 * empty there and only the open-redirect checks remain.
 */
export function isWithinShop(
  raw: string | null | undefined,
  base: string,
): boolean {
  if (!raw || !raw.startsWith("/")) return false
  if (raw.startsWith("//") || raw.startsWith("/\\")) return false
  if (!base) return true
  const path = raw.split("?")[0]!
  return path === base || path.startsWith(`${base}/`)
}

export type Decision =
  /** Serve the request unchanged. */
  | { type: "next" }
  /** Serve the request, but drop this app's session cookies first. */
  | { type: "clear" }
  /** Send the visitor somewhere else. `clearCookies` drops the stale jar too. */
  | { type: "redirect"; to: string; clearCookies: boolean }

interface Input {
  /**
   * The path **as the browser shows it**, before any internal rewrite.
   *
   * On the apex that is `/acme/checkout`; on the shop's own host it is
   * `/checkout`. Every redirect this function returns is in the same
   * vocabulary, so the address bar never gains or loses a slug segment.
   */
  pathname: string
  /**
   * The resolved shop, or null on the marketplace directory at `/`.
   *
   * Resolved by `proxy.ts` from the hostname first and the path second — see
   * `shared/lib/tenant.ts`. Never re-derived here: on a shop host the first
   * path segment is a section, and reading it as a shop un-gates `/checkout`.
   */
  shopSlug: string | null
  /**
   * The prefix a link to this shop starts with: `/acme` on the apex, `""` on
   * the shop's own host. Every redirect below is built from it.
   */
  base: string
  /**
   * This app's access-token cookie **for the resolved shop**.
   *
   * Absent means "no session at this shop", which a signed-in-elsewhere visitor
   * and a signed-out one produce identically — and that collapse is the point:
   * no new `Decision` variant, no new copy, and arriving at `/beta/checkout`
   * signed in at `acme` reads as an ordinary sign-in.
   */
  token: string | undefined
  /** The `?expired` marker the Apollo error link appends on a failed refresh. */
  expired: boolean
  /** `?redirect` — where the visitor was heading before they were bounced. */
  redirect?: string | null
}

/**
 * The section of the storefront a path is asking for, relative to the shop.
 *
 * `/acme/checkout` under the apex and `/checkout` on the shop's own host are
 * the same screen, so both must yield `checkout`. The shop home yields `""` in
 * both. Anything outside the shop's prefix yields `""` as well, which reads as
 * the home page and is never gated — correct, because a path that is not under
 * this shop is not a private page of this shop.
 */
function sectionOf(pathname: string, base: string): string {
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname
  return rest.split("/").filter(Boolean)[0] ?? ""
}

export function routeDecision({
  pathname,
  shopSlug,
  base,
  token,
  expired,
  redirect,
}: Input): Decision {
  // No shop at all (the marketplace directory) — nothing here is ever gated.
  if (!shopSlug) return { type: "next" }

  const section = sectionOf(pathname, base)
  const isPrivate = (PRIVATE_SEGMENTS as readonly string[]).includes(section)
  const isGuestOnly = (GUEST_ONLY_SEGMENTS as readonly string[]).includes(section)

  // Upstream rejected the token — clear the jar and let the visitor reach the
  // sign-in screen rather than bouncing them between it and a private route.
  if (token && expired) {
    return isGuestOnly
      ? { type: "clear" }
      : {
          type: "redirect",
          to: `${base}/login?expired=1`,
          clearCookies: true,
        }
  }

  if (token) {
    // Already signed in: the sign-in and sign-up screens have nothing to offer.
    // Land on the account page rather than the shop home, because arriving at
    // /login while signed in almost always means "I want my account".
    if (isGuestOnly) {
      // Honour where they were actually going. Without this, a visitor already
      // signed in who lands on `/acme/login?redirect=/acme/checkout` (an old
      // link, or a retired slug redirecting here) is dropped on their account
      // page instead of the page they asked for.
      const to = isWithinShop(redirect, base) ? redirect! : `${base}/account`
      return { type: "redirect", to, clearCookies: false }
    }
    return { type: "next" }
  }

  if (isPrivate) {
    return {
      type: "redirect",
      to: `${base}/login?redirect=${encodeURIComponent(pathname)}`,
      clearCookies: false,
    }
  }

  return { type: "next" }
}
