import { CART_SESSION_COOKIE } from "@/shared/auth/cookie-names"
import { getCookie, setCookie } from "@/shared/lib/cookies"

/**
 * The anonymous cart identity.
 *
 * The back-end's cart is keyed on `user_id` when there is one and on a caller-
 * supplied `session_id` when there is not (`CartResolver` takes both and
 * `OptionalJwtGuard` decides which applies). So a visitor with no account still
 * gets a real server-side cart — as long as this app sends the *same* id on
 * every call and keeps sending it across reloads.
 *
 * A cookie rather than `localStorage` for one reason: it is readable from a
 * server component too, which is what lets the first paint of `/[shopSlug]/cart`
 * know the visitor has items instead of flashing an empty cart and filling in.
 */

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

/** Opaque, unguessable, and never used for authorization. */
function newSessionId(): string {
  // `randomUUID` is missing on Safari before 15.4 and on any non-secure origin,
  // where `getRandomValues` is still available — so the fallback is a real code
  // path on a plain-http staging box, not a theoretical one.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Read the visitor's cart session id, minting one on first use.
 *
 * Returns null on the server — a server component reads the cookie through
 * `next/headers` instead (see `readCartSessionFromRequest`), because it can
 * neither read `document.cookie` nor mint an id the browser would keep.
 */
export function getOrCreateCartSessionId(): string | null {
  if (typeof document === "undefined") return null

  const existing = getCookie(CART_SESSION_COOKIE)
  if (existing) return existing

  const created = newSessionId()
  setCookie(CART_SESSION_COOKIE, created, { maxAge: ONE_YEAR_SECONDS })
  return created
}

/** Read-only variant: never mints, so it is safe during render. */
export function peekCartSessionId(): string | null {
  if (typeof document === "undefined") return null
  return getCookie(CART_SESSION_COOKIE)
}
