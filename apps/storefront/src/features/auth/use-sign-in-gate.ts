"use client"

import { useCallback } from "react"

import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { useCurrentUser } from "./use-current-user"

/**
 * "Sign in first" for controls that lead somewhere guarded.
 *
 * `proxy.ts` is still the boundary — a signed-out request for `/checkout` is
 * redirected on the server whatever the browser does — but a shopper who is
 * *already here* should not have to watch the cart they filled be replaced by
 * a sign-in screen to learn they need an account. So the click is caught
 * before the navigation, the popup opens over the cart, and the destination
 * rides along as the redirect: the same page load the guard would have caused
 * happens once, after the session exists, instead of twice around it.
 *
 * It returns `true` when it took the click. Before hydration it returns
 * `false` and lets the link navigate: the token lives in a cookie the server
 * has already read, so guessing here would send a signed-in shopper to a
 * sign-in popup for a route they can reach.
 */
export function useSignInGate(): (destination: string) => boolean {
  const { isAuthenticated, hydrated } = useCurrentUser()
  const openAuth = useAuthDialogStore((s) => s.open)

  return useCallback(
    (destination: string) => {
      if (!hydrated || isAuthenticated) return false
      openAuth("login", destination)
      return true
    },
    [hydrated, isAuthenticated, openAuth],
  )
}
