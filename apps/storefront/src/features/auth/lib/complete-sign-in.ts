import type { ApolloClient } from "@apollo/client"

import { adoptGuestCart } from "@/features/cart/adopt-guest-cart"
import { adoptGuestWishlist } from "@/features/wishlist/adopt-guest-wishlist"
import { shopHomeHref } from "@/shared/lib/tenant"
import { useAuthStore } from "@/shared/stores/auth"

import { safeRedirect } from "./redirect"

export type SignInTokens = {
  access_token: string
  refresh_token: string
  access_token_expires_at?: string | null
  refresh_token_expires_at?: string | null
}

type FinishArgs = {
  slug: string
  base: string
  client: ApolloClient
  redirect: string | null
}

/**
 * Persist the session, hand over guest cart + wishlist, then hard-navigate.
 *
 * Every way into a session (today, the phone code) must end
 * here — or the cart filled while signed out becomes unreachable the moment
 * the token exists, because cart calls then resolve on the customer alone.
 * See auth.md.
 */
export async function completeSignIn({
  tokens,
  ...rest
}: FinishArgs & { tokens: SignInTokens }): Promise<void> {
  await useAuthStore.getState().setTokens(rest.slug, tokens)
  await finishSignIn(rest)
}

/**
 * The half after the session exists. A new customer's sign-in stores the
 * session first so the "your name" step can save with it, then ends here.
 */
export async function finishSignIn({
  slug,
  base,
  client,
  redirect,
}: FinishArgs): Promise<void> {
  await adoptGuestCart(client)
  await adoptGuestWishlist(client, slug)
  window.location.assign(safeRedirect(redirect, shopHomeHref(base)))
}
