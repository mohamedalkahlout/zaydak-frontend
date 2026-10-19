import { shopSessionOf } from "@/shared/stores/auth"
import { getCookie } from "@/shared/lib/cookies"
import { accessCookie } from "./cookie-names"

/**
 * The bearer token for a call leaving the browser **on behalf of one shop**, or
 * null when there is no session for it.
 *
 * **The store first, the cookie second, and the order is load-bearing.**
 * `useAuthStore.hydrate()` only runs in an effect — after the first render — so
 * on a freshly loaded page the store is still empty while the readable access
 * cookie already holds a valid token. Without the fallback the first request of
 * every page load would go out unauthenticated, which on the storefront means a
 * signed-in shopper's own account data quietly resolving as a guest's.
 *
 * **The slug is an argument, not something read in here.** `currentShopSlug()`
 * reads `location.pathname` at call time, and during a client-side navigation
 * the pathname flips before in-flight operations settle — so deriving it here
 * would pair one shop's token with the next shop's request. The caller knows
 * which shop its operation belongs to; it passes it.
 *
 * A null slug returns null, and that is required rather than defensive: `/`,
 * the shop directory, must send neither a token nor `X-SHOP`.
 *
 * Its own module rather than a private function in `apollo/client.tsx` because
 * Apollo is no longer the only thing that needs it: the assistant's SSE turn is
 * a plain `fetch` and has to carry the same identity a GraphQL call does.
 * Copying two lines would be two places for that ordering rule to live, and the
 * copy is the one that would not get fixed.
 */
export function sessionAccessToken(slug: string | null): string | null {
  if (!slug) return null
  return shopSessionOf(slug).accessToken ?? getCookie(accessCookie(slug))
}
