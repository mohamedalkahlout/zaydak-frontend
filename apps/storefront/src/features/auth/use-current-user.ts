"use client"

import { useEffect } from "react"
import { useQuery } from "@apollo/client/react"

import {
  useAuthStore,
  useShopSession,
  type CurrentUser,
} from "@/shared/stores/auth"
import { useShopSlug } from "@/shared/lib/use-shop-slug"
import { MY_PROFILE } from "./api"

/**
 * Who is signed in, as one query and one store.
 *
 * Split in two on purpose. `useCurrentUserSync` is the single **owner** — it is
 * mounted once, by `ShopShell`, and is the only thing in the app that runs the
 * `MY_PROFILE` query. `useCurrentUser` is the **reader** every screen calls, and it
 * touches no network at all.
 *
 * Before this, the profile was fetched independently by the account hub and the
 * checkout form, and the header could not answer "is anyone signed in" without
 * adding a third copy. Apollo's cache would have deduplicated the requests, but
 * not the loading states: each caller had its own, so the same fact appeared at
 * a different moment in each place. One owner means one moment.
 *
 * Both halves read the session **of the shop in the URL**. A session belongs to
 * one storefront, so "who is signed in" has no answer until you say where —
 * and the answer is that shop's customer, never a platform account.
 */

/**
 * Runs the profile query and mirrors it into the auth store.
 *
 * Call exactly once, high in the tree. `skip` keeps it off the wire for a
 * signed-out visitor — which is most of this app's traffic — and `hydrated`
 * holds it until this shop's token cookie has actually been read, so the very
 * first client render does not decide "no session" from a store that has not
 * looked. `hydratedFor` is what makes that per shop: a bare boolean would let
 * shop B's first render answer from a store that has only ever read shop A's.
 */
export function useCurrentUserSync(): void {
  const slug = useShopSlug()
  const hydrated = useAuthStore((s) => s.hydrated && s.hydratedFor === slug)
  const { isAuthenticated } = useShopSession(slug)

  const { data, loading, error } = useQuery(MY_PROFILE, {
    skip: !hydrated || !isAuthenticated || !slug,
    // The name and email are shown, never gated on — a stale copy for one paint
    // costs nothing, and a network round trip on every navigation costs a paint.
    fetchPolicy: "cache-first",
  })

  useEffect(() => {
    if (!slug) return
    const { setUser, setUserStatus } = useAuthStore.getState()

    if (!hydrated || !isAuthenticated) {
      setUser(slug, null)
      setUserStatus(slug, "idle")
      return
    }
    if (loading) {
      setUserStatus(slug, "loading")
      return
    }
    // An error here is not a sign-out. A failed profile on a flaky connection
    // still leaves a valid token; the Apollo error link is what handles a token
    // the back-end actually rejected. So the status settles and the user stays
    // null — "signed in, profile unknown" — rather than the header pretending
    // nobody is here.
    setUser(
      slug,
      error
        ? null
        : ((data?.myCustomerProfile.data as CurrentUser | undefined) ?? null),
    )
  }, [slug, hydrated, isAuthenticated, loading, error, data])
}

export interface CurrentUserResult {
  user: CurrentUser | null
  /** True while there is a session whose profile has not arrived yet. */
  loading: boolean
  isAuthenticated: boolean
  /** False until the token cookie has been read. Guards first-render markup. */
  hydrated: boolean
}

/** Read-only view of the customer signed in **at this shop**. Runs no query. */
export function useCurrentUser(): CurrentUserResult {
  const slug = useShopSlug()
  const { user, userStatus, isAuthenticated } = useShopSession(slug)
  const hydrated = useAuthStore((s) => s.hydrated && s.hydratedFor === slug)

  return {
    user,
    loading: isAuthenticated && userStatus !== "ready",
    isAuthenticated,
    hydrated,
  }
}
