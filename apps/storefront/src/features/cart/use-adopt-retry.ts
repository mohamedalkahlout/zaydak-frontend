"use client"

import { useEffect } from "react"
import { useApolloClient } from "@apollo/client/react"

import { accessCookie } from "@/shared/auth/cookie-names"
import { getCookie } from "@/shared/lib/cookies"
import { useShopSlug } from "@/shared/lib/use-shop-slug"
import { adoptGuestCart, consumePendingAdopt } from "./adopt-guest-cart"

/**
 * The second chance for a guest-to-user cart merge.
 *
 * `adoptGuestCart` never throws, and it never makes a sign-in fail — but a
 * merge it could not carry out leaves the guest cart exactly where the bug it
 * fixes used to leave the whole feature: orphaned. The most common cause is the
 * 5/60s throttle on `syncCart` refusing a merge that follows an ordinary cart
 * write too closely, which an immediate retry would just hit again. So the
 * failed attempt arms a `pending` flag, and this hook — mounted once, in the
 * shop shell — wastes exactly one attempt on the next **signed-in** page load,
 * by which point the throttle has usually let go.
 *
 * One attempt per load, not one per mount: the flag is consumed up front, so N
 * mounted consumers could not each fire. The signed-in gate reads the access
 * cookie rather than the auth store because this effect can run before the
 * store has hydrated for this shop — and the cookie is exactly what the Apollo
 * link will send, so "is there a cookie" is "would `syncCart` be accepted".
 * A signed-out visitor's flag is dropped rather than kept: a later sign-in runs
 * `adoptGuestCart` itself and re-arms from the result.
 */
export function useAdoptRetry(): void {
  const client = useApolloClient()
  const slug = useShopSlug()

  useEffect(() => {
    if (!slug) return
    if (!consumePendingAdopt()) return
    if (!getCookie(accessCookie(slug))) return
    void adoptGuestCart(client)
  }, [client, slug])
}