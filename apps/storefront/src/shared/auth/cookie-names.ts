/**
 * Cookie keys for the customer storefront.
 *
 * Deliberately dependency-free so `proxy.ts` (Edge runtime), the route
 * handlers, and client code can all import the same constants.
 *
 * **Two levels of scoping, for two different reasons.**
 *
 * The `shop_` prefix separates this app from the two consoles. Cookies are not
 * isolated by port (RFC 6265 §8.5), so the vendor dashboard on `localhost:3001`,
 * the console on `:3002` and this storefront on `:3003` share one jar — an
 * unprefixed `access_token` would mean a vendor who signed into the dashboard
 * arrives here already "authenticated" as a customer. The same collision hits
 * any two of these deployed under one apex domain.
 *
 * The **shop key after that prefix** separates one storefront from another.
 * A session is minted for one shop and authorizes nothing at the next: signing
 * in at `/acme` must not let that account act at `/beta`. The back-end is what
 * enforces it (the access token carries a `shop_id` claim and `ShopHeaderGuard`
 * refuses a mismatch); these names are what make the storefront *behave* like
 * it — `/beta` simply finds no session and shows a sign-in form, rather than
 * looking signed in and failing on the first mutation.
 *
 * Names rather than `path` scoping, and that choice is load-bearing. A cookie
 * at `path=/acme` is invisible to `document.cookie` on any other path and
 * cannot be deleted by `removeCookie`, which writes at `path=/` — and
 * `/api/auth/refresh` lives outside every shop segment, so it could not read
 * the refresh cookie at all.
 */

/**
 * The anonymous cart id. A visitor with no account still has a cart, and the
 * back-end keys it on a `session_id` the caller invents — so it has to survive
 * a reload, and it has to be readable by client JS to be sent as a GraphQL
 * argument. Not httpOnly for that reason; it is an opaque random id that
 * authorizes nothing.
 *
 * Deliberately **not** per-shop: `Cart` is keyed on `(shop_id, session_id)` in
 * the database, so one id already yields a separate cart per shop. Splitting it
 * would hand a returning visitor a new empty basket at every storefront.
 */
export const CART_SESSION_COOKIE = "shop_cart_session"

/**
 * The four flat names this app used before sessions were per-shop.
 *
 * Still exported for exactly one reason: `proxy.ts` deletes them on sight, so a
 * dead jar from before the change does not ride along for seven days. They are
 * never read as credentials — a token minted before the back-end shipped its
 * half carries no `shop_id` claim, so adopting one would write a shop-scoped
 * credential from a session the server never scoped.
 */
export const LEGACY_ACCESS_TOKEN_COOKIE = "shop_access_token"
export const LEGACY_ACCESS_EXPIRES_COOKIE = "shop_access_token_expires_at"
export const LEGACY_REFRESH_TOKEN_COOKIE = "shop_refresh_token"
export const LEGACY_REFRESH_EXPIRES_COOKIE = "shop_refresh_token_expires_at"

export const LEGACY_SESSION_COOKIES = [
  LEGACY_ACCESS_TOKEN_COOKIE,
  LEGACY_ACCESS_EXPIRES_COOKIE,
  LEGACY_REFRESH_TOKEN_COOKIE,
  LEGACY_REFRESH_EXPIRES_COOKIE,
] as const

/**
 * A slug that is safe to embed in a cookie **name**.
 *
 * RFC 6265's cookie-name is a token: no whitespace, no control characters, and
 * none of `= ; , ( ) < > @ : \ " / [ ] ? { }`. The `[shopSlug]` segment is
 * whatever a visitor typed, so it can never be interpolated raw.
 */
const SLUG_TOKEN_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** FNV-1a/32, base36. Pure and synchronous — identical in Node, Edge and the browser. */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/**
 * The cookie-name segment for a shop.
 *
 * It **normalises rather than rejects**, and that is not tidiness. Shop slugs
 * are derived server-side by `slugify(name)` and never re-validated, and
 * `slugify` returns the empty string for a name with no Latin characters — so
 * a real shop can carry a slug that fails a strict token test. Rejecting would
 * mean the credentials are accepted, a refresh row is written, and *then* the
 * cookie write fails: a shop permanently unable to sign anyone in, with nothing
 * in the logs saying why. An unusual slug gets a stable derived key instead.
 *
 * The `.` prefix marks the derived form. `SLUG_TOKEN_RE` forbids `.`, so a
 * hashed key can never collide with a literal slug, and an ordinary slug stays
 * readable in devtools.
 */
export function shopCookieKey(slug: string): string {
  if (slug.length > 0 && slug.length <= 64 && SLUG_TOKEN_RE.test(slug)) {
    return slug
  }
  return `.${fnv1a32(slug)}`
}

export const accessCookie = (slug: string) =>
  `shop_${shopCookieKey(slug)}_access_token`
export const accessExpiresCookie = (slug: string) =>
  `shop_${shopCookieKey(slug)}_access_expires_at`
export const refreshCookie = (slug: string) =>
  `shop_${shopCookieKey(slug)}_refresh_token`
export const refreshExpiresCookie = (slug: string) =>
  `shop_${shopCookieKey(slug)}_refresh_expires_at`

/** All four names for one shop, in a fixed order. */
export function sessionCookieNames(slug: string): string[] {
  return [
    accessCookie(slug),
    accessExpiresCookie(slug),
    refreshCookie(slug),
    refreshExpiresCookie(slug),
  ]
}

/**
 * Matches exactly the four per-shop session cookies and nothing adjacent: not
 * `shop_cart_session`, not `shop_sessions`, and not the four legacy flat names
 * (which have no key segment before the suffix).
 */
export const SESSION_COOKIE_RE =
  /^shop_(.+)_(access_token|access_expires_at|refresh_token|refresh_expires_at)$/

/** httpOnly index of which shops hold a session, most recently signed-in first. */
export const SESSION_INDEX_COOKIE = "shop_sessions"

/**
 * How many shops may hold a session at once.
 *
 * Four cookies per shop, all at `path: "/"`, all sent on every request: roughly
 * 770 bytes per shop (a ~530-byte access JWT, a 64-hex refresh token, two ISO
 * timestamps, plus the names). Four shops is ~3.1 KB against the 16 KB
 * request-header ceiling Node, Vercel and Cloudflare all enforce — and the jar
 * is shared with the vendor and admin apps under one apex domain, so the margin
 * is deliberate. The per-cookie 4 KB cap is never approached.
 */
export const MAX_SHOP_SESSIONS = 4
