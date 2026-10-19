import type { ApolloClient } from "@apollo/client"

import {
  clearGuestWishlist,
  readGuestWishlist,
} from "@/shared/lib/guest-wishlist"
import { TOGGLE_WISHLIST, WISHLISTS } from "./api"

/**
 * Session flag that tells the saved-items page a handover happened.
 *
 * The wishlist twin of the cart's `cart.merge.notice`, for the same reason and
 * in the same place: `adoptGuestWishlist` runs between `setTokens` and a
 * document load, so the news that the guest hearts are now on the account has
 * to survive that navigation. `sessionStorage` fits because the sign-in
 * happened in this tab and the notice is about that act.
 */
const MERGE_NOTICE_KEY = "wishlist.merge.notice"

/** Read-and-clear. True when a sign-in moved guest hearts onto the account. */
export function consumeWishlistMergeNotice(): boolean {
  if (typeof sessionStorage === "undefined") return false
  if (sessionStorage.getItem(MERGE_NOTICE_KEY) === null) return false
  sessionStorage.removeItem(MERGE_NOTICE_KEY)
  return true
}

/**
 * How many saved items to read back before deciding what to add.
 *
 * The guest list is capped at 200 and `wishlists` pages at a caller-chosen
 * limit, so one generous page covers every realistic account. An account
 * holding more than this loses nothing: the worst case is re-adding something
 * already saved, which `toggleWishlist` would *remove* — which is exactly why
 * the read exists, and why a partial read is still better than none.
 */
const ACCOUNT_PAGE = 200

/**
 * Hand the signed-out wishlist to the account that has just signed in.
 *
 * The wishlist twin of `adoptGuestCart`, and it runs in the same place for the
 * same reason: after `setTokens`, because it needs the token, and before the
 * navigation, because a document load discards the client that would make the
 * call.
 *
 * **The dangerous part is that the server operation is a `toggle`, not an
 * `add`.** Replaying a staged id for a product the account had already saved
 * would *remove* it — the same shape of bug as syncing an empty cart, and
 * quieter, because it looks like nothing happened until the customer notices an
 * old favourite missing. So this reads what the account already holds and sends
 * only the difference. Anything already saved is left alone.
 *
 * **Storage is cleared only for what actually landed.** A partial failure
 * leaves the rest staged, so the next sign-in on this browser tries again
 * rather than dropping items on the floor.
 *
 * Sequential rather than parallel: each `toggleWishlist` refetches `wishlists`,
 * and firing twenty at once means twenty refetches racing to write the same
 * cache entry. A saved-items list is small and this runs once per sign-in.
 *
 * Returns how many items were moved. A caller that wants to say so out loud
 * reads the notice flag this function arms when the count is non-zero.
 */
export async function adoptGuestWishlist(
  client: ApolloClient,
  slug: string,
): Promise<number> {
  const staged = readGuestWishlist(slug)
  if (staged.length === 0) return 0

  try {
    // What the account already has. `wishlists` spans every shop, which is
    // right here: the guest list is this shop's, but a product saved from
    // another storefront is still saved, and toggling it would unsave it.
    const existing = await client.query({
      query: WISHLISTS,
      variables: { page: 1, limit: ACCOUNT_PAGE },
      fetchPolicy: "no-cache",
    })

    const already = new Set(
      (existing.data?.wishlists.data ?? []).map((entry) => entry.product_id),
    )

    const missing = staged.filter((id) => !already.has(id))
    if (missing.length === 0) {
      // Everything staged was already saved. Nothing to send, but the local
      // copy has served its purpose and would otherwise be replayed forever.
      clearGuestWishlist(slug)
      return 0
    }

    const moved: string[] = []
    for (const productId of missing) {
      try {
        await client.mutate({
          mutation: TOGGLE_WISHLIST,
          variables: { input: { product_id: productId } },
        })
        moved.push(productId)
      } catch {
        // One unsaveable product — deleted, unpublished, or belonging to a shop
        // that has since closed — must not strand the rest of the list.
      }
    }

    // Keep whatever did not land, so the next sign-in retries it.
    const remaining = staged.filter((id) => !moved.includes(id) && !already.has(id))
    if (remaining.length === 0) clearGuestWishlist(slug)

    // The hearts that left the browser are now on the account — say so when the
    // saved-items page next opens, the same silent-handover gap the cart's
    // merge notice closes. A partial failure arms it too: the moved ones are
    // the proof the handover is happening.
    if (moved.length > 0) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(MERGE_NOTICE_KEY, "1")
      }
    }

    return moved.length
  } catch {
    // The account's list could not be read, so there is no safe difference to
    // send — sending the staged ids blind is what would unsave things. Left in
    // storage for the next attempt.
    return 0
  }
}
