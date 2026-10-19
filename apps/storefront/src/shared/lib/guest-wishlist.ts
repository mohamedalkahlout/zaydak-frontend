import { shopCookieKey } from "@/shared/auth/cookie-names"

/**
 * The signed-out wishlist, as product ids in the browser.
 *
 * **`localStorage`, where the cart's guest identity is a cookie, and the
 * difference is what each one is for.** The cart's `session_id` names a cart
 * the *server* owns — it has to reach the back-end on every call, and be
 * readable by a server component so the first paint of `/cart` is not an empty
 * box. A saved-items list is neither: nothing on the server is keyed on it,
 * nothing renders from it before hydration, and sending it as a header on every
 * request would be paying for reach it never uses.
 *
 * **Per shop, unlike the cart cookie.** `Cart` is keyed on
 * `(shop_id, session_id)` in the database, so one cart id already yields a
 * separate basket per storefront. Nothing partitions this one, so the key does
 * — and it has to, because the saved-items page shows only the shop the visitor
 * is standing in, and signing in at `/acme` must not push `/beta`'s saved items
 * onto the account. `shopCookieKey` is reused rather than a second normaliser
 * written: it already answers "what is the safe storage segment for this slug",
 * including for the slugs `slugify` renders empty.
 *
 * Every access is wrapped, because `localStorage` **throws** rather than
 * returning null in a Safari private window and under a browser set to block
 * site data. An unreadable list degrades to an empty one, which shows the
 * visitor an unsaved heart — wrong, but recoverable by clicking it. An
 * exception during render is not.
 */

const PREFIX = "shop_wishlist_"

/** Bounded so a long-lived browser cannot grow an unbounded key. */
const MAX_ITEMS = 200

export function guestWishlistKey(slug: string): string {
  return `${PREFIX}${shopCookieKey(slug)}`
}

/** The saved product ids for one shop. Empty on the server and on any failure. */
export function readGuestWishlist(slug: string): string[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(guestWishlistKey(slug))
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    // Validated rather than trusted: this is user-writable storage, and a
    // hand-edited or half-written value must not reach a GraphQL variable.
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

/** Replace the list. Silently a no-op when storage is unavailable. */
export function writeGuestWishlist(slug: string, ids: string[]): void {
  if (typeof window === "undefined") return

  try {
    const key = guestWishlistKey(slug)
    if (ids.length === 0) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(ids.slice(0, MAX_ITEMS)))
  } catch {
    // Quota exceeded, or storage blocked. The heart will read back unsaved on
    // the next mount, which is the honest outcome — better than a UI insisting
    // something is saved that nothing recorded.
  }
}

/** Drop the shop's list once its contents belong to an account. */
export function clearGuestWishlist(slug: string): void {
  writeGuestWishlist(slug, [])
}

/**
 * Drop the staged ids the storefront no longer returns after a rehydration.
 *
 * A rehydration asks for exactly the staged ids, so an id that comes back is
 * definitively still on the shop's storefront and one that does not is
 * deleted, unpublished or the shop is off — a corpse that would otherwise be
 * retried on every future sign-in. A no-op when nothing is missing.
 */
export function pruneGuestWishlist(
  slug: string,
  keepIds: ReadonlySet<string>,
): void {
  if (typeof window === "undefined") return

  const current = readGuestWishlist(slug)
  if (current.length === 0) return

  const next = current.filter((id) => keepIds.has(id))
  if (next.length === current.length) return

  writeGuestWishlist(slug, next)
}
