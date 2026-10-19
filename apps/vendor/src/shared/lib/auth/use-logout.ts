"use client"

import { useCallback } from "react"
import { useAuthStore } from "@/shared/stores/auth"
import { clearApolloCache } from "./apollo-bridge"

/**
 * Log out a user cleanly:
 *  1. Hit `/api/auth/logout` (revokes refresh on server + clears httpOnly
 *     refresh cookie + active_shop_slug cookie).
 *  2. Clear the access-token memory state (which also clears the active
 *     shop slug in localStorage + its mirror cookie).
 *  3. Drop the Apollo cache so nothing from this session leaks to the next.
 *  4. Redirect to /login (hard nav — forces SSR layouts to re-evaluate).
 */
export function useLogout() {
  return useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      })
    } catch {
      // Best-effort — proceed with local cleanup regardless.
    }

    useAuthStore.getState().clearTokens()
    await clearApolloCache()

    if (typeof window !== "undefined") {
      window.location.replace("/login")
    }
  }, [])
}
