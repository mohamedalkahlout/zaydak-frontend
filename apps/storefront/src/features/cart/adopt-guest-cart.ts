import type { ApolloClient } from "@apollo/client"

import { peekCartSessionId } from "@/shared/lib/cart-session"
import { CART, SYNC_CART } from "./api"

/**
 * Where this module tells the cart page and the reconciler what a merge did.
 *
 * Both flags live in `sessionStorage`, not a module store, because the handover
 * ends with a document load (`window.location.assign` in the auth forms) and a
 * Zustand store dies with the document. "Per tab" is the right lifetime anyway:
 * the sign-in that produced the merge happened in this tab, and the notice is
 * about that act.
 *
 * `notice` — a merge *succeeded*: the account's cart was replaced by the guest
 * cart, so the next /cart visit should say so. Consumed by `CartPage`.
 *
 * `pending` — a merge *failed*: the guest cart is orphaned until somebody moves
 * it. Consumed by `useAdoptRetry`, which retries on the next signed-in page
 * load. Both are singletons by design: one cart per tab, and each flag is
 * either owed or it is not.
 */
const MERGE_NOTICE_KEY = "cart.merge.notice"
const ADOPT_PENDING_KEY = "cart.merge.pending"

function setStorage(key: string): void {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(key, "1")
}

/** Read-and-clear. True when the flag was owed. */
export function consumeMergeNotice(): boolean {
  if (typeof sessionStorage === "undefined") return false
  if (sessionStorage.getItem(MERGE_NOTICE_KEY) === null) return false
  sessionStorage.removeItem(MERGE_NOTICE_KEY)
  return true
}

/** Read-and-clear. True when a failed merge is owed a retry. */
export function consumePendingAdopt(): boolean {
  if (typeof sessionStorage === "undefined") return false
  if (sessionStorage.getItem(ADOPT_PENDING_KEY) === null) return false
  sessionStorage.removeItem(ADOPT_PENDING_KEY)
  return true
}

/**
 * Hand the signed-out cart to the account that has just signed in.
 *
 * **The gap this closes.** A guest's cart is a real server-side cart keyed on
 * the `shop_cart_session` cookie. The moment a token exists, every cart call
 * resolves differently: `CartRepository.getOrCreateCart` takes `user_id` when
 * there is one and *never looks at* `session_id`, so the cart the customer
 * filled before signing in is not merged, not emptied and not shown — it is
 * simply no longer addressable, still holding its stock reservations until the
 * reaper expires it. From the shopper's side the items vanish at the exact
 * moment they did what the checkout asked them to do.
 *
 * `CartSyncService` has done this merge since it was written — its own docblock
 * says "invoked once on successful login" — but nothing on the storefront ever
 * called it. This is that call.
 *
 * **Never sends an empty list, and that guard is the whole reason this is a
 * function rather than one line in a form.** The merge is deliberately
 * destructive on the user's side (the back-end soft-deletes the account's items
 * and replaces them with these — "the cart you were composing logged-out wins",
 * the same call Shopify makes). Handed `items: []` it would do exactly that
 * with nothing to put back, so a customer signing in on a device where they had
 * browsed but added nothing would find the cart they left last week wiped. No
 * guest items means there is nothing to hand over and nothing to do.
 *
 * **Reads the guest cart unauthenticated, on purpose.** By the time this runs
 * the session cookie is already written, so an ordinary read would return the
 * *account's* cart and we would sync it onto itself. `authorization: ""` is the
 * same override login and register use to keep a stale token off a call, and
 * here it is what makes the read mean "the cart of the visitor who was just
 * anonymous". `no-cache` keeps that guest snapshot out of the store, where it
 * would sit under the same key the authenticated cart query uses.
 *
 * **Failure is swallowed, and it is not the last word.** Signing in succeeded;
 * the token is written and the customer is authenticated. Throwing here would
 * turn a lost cart into a failed login, which is strictly worse, so the caller
 * navigates either way — but a failed merge is recorded as a pending one (see
 * the flags above) and `useAdoptRetry` retries it on the next signed-in load,
 * which is what eventually closes the gap the 5/60s `syncCart` throttle can
 * open between the first attempt and the shopper's first post-login read.
 *
 * Returns whether anything was actually moved. A caller that needs more — "did
 * it merge, was there nothing to merge, or did it fail" — reads the flags this
 * function arms before it returns.
 */
export async function adoptGuestCart(
  client: ApolloClient,
): Promise<boolean> {
  // `peek` rather than `getOrCreate`: minting an id here would be inventing a
  // guest cart for somebody who never had one, purely to ask if it is empty.
  const sessionId = peekCartSessionId()
  if (!sessionId) {
    // No guest identity means there is and never was anything to hand over, so
    // a retry armed by an earlier failure is void: the cart it would have moved
    // is the same non-existence.
    clearAdoptPending()
    return false
  }

  try {
    const guest = await client.query({
      query: CART,
      variables: { session_id: sessionId },
      context: { headers: { authorization: "" } },
      fetchPolicy: "no-cache",
    })

    const items = guest.data?.cart.data?.items ?? []
    if (items.length === 0) {
      // Empty now, so there is nothing to move and nothing to retry — a guest
      // cart read as empty is the definitive answer to "is a merge owed?".
      clearAdoptPending()
      return false
    }

    await client.mutate({
      mutation: SYNC_CART,
      variables: {
        input: {
          session_id: sessionId,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            ...(item.variation_option_id
              ? { variation_option_id: item.variation_option_id }
              : {}),
            // Carried through rather than dropped: a personalised line is not
            // the same product without it, and `SyncCartItemInput` takes it.
            ...(item.custom_options
              ? { custom_options: item.custom_options }
              : {}),
            ...(item.composition ? { composition: item.composition } : {}),
          })),
        },
      },
    })

    // The merge replaces the account's cart — "the cart you were composing
    // logged-out wins" — so the shopper who just lost their saved cart is told
    // so when they next look at the cart. And a retry that finally succeeded
    // must not be retried again.
    setStorage(MERGE_NOTICE_KEY)
    clearAdoptPending()
    return true
  } catch {
    // Armed rather than left to drop: the guest cart is real but orphaned
    // (most often because `syncCart` throttled), and the next signed-in cart
    // read is the right moment to try once more.
    setStorage(ADOPT_PENDING_KEY)
    return false
  }
}

function clearAdoptPending(): void {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.removeItem(ADOPT_PENDING_KEY)
}
