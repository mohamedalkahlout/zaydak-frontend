"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"

import { useCurrentUser } from "@/features/auth/use-current-user"
import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { RECORD_CART_LINK_OPEN } from "./api"

/**
 * The query parameter a recovery reminder's cart link carries. Must match the
 * back-end's `CART_LINK_PARAM` (`back-end/src/cart/lib/cart-link-token.ts`).
 */
export const REMINDER_LINK_PARAM = "rc"

/**
 * Report a click on a recovery reminder's cart link, once, and tidy the URL.
 *
 * Both reminder senders — the merchant's manual send and the automatic cadence
 * email — link to `/cart?rc=<token>` on the shop's own address. This reads the
 * token after hydration, sends it to `recordCartLinkOpen`, and removes it from
 * the address bar, so a reload, a bookmark or a link the shopper shares does
 * not carry it on.
 *
 * **Stripping is what makes it fire once.** The parameter is removed before the
 * mutation goes out, so a second run of this effect — Strict Mode's double
 * mount, a remount, a client that changed identity — finds nothing to send.
 * `replaceState` rather than a router navigation: nothing on the page depends
 * on the parameter, and a navigation would refetch the route for no reason.
 * Next's App Router picks the native call up, so its own view of the URL stays
 * in step.
 *
 * **Prompts signed-out shoppers to sign in.** An abandoned cart is keyed on the
 * customer's account, but clicking a reminder on another device or in a private
 * tab lands on an empty guest cart. Arriving with `?rc=` prompts the shopper to
 * sign in so their account's cart is loaded.
 *
 * Runs in an effect, never during render, on purpose: the server has no
 * business recording a click, and a link preview (WhatsApp, Slack) that fetches
 * the HTML without running scripts must not count as one.
 *
 * Best-effort. A token from an old link (or a rotated secret) is refused by the
 * back-end; the error link logs it and the shopper, who came here for their
 * cart, sees nothing.
 */
export function useReminderLinkOpen(): void {
  const client = useApolloClient()
  const { isAuthenticated, hydrated } = useCurrentUser()
  const openAuth = useAuthDialogStore((s) => s.open)
  const arrivedWithToken = useRef(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    const token = url.searchParams.get(REMINDER_LINK_PARAM)
    if (!token) return

    arrivedWithToken.current = true

    url.searchParams.delete(REMINDER_LINK_PARAM)
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    )

    client
      .mutate({ mutation: RECORD_CART_LINK_OPEN, variables: { token } })
      .catch(() => {
        // Already logged by the error link; nothing to show the shopper.
      })
  }, [client])

  useEffect(() => {
    if (!arrivedWithToken.current || !hydrated) return
    arrivedWithToken.current = false

    if (!isAuthenticated) {
      openAuth("login")
    }
  }, [hydrated, isAuthenticated, openAuth])
}
