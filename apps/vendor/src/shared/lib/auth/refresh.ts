/**
 * Cross-layer access token refresh coordination.
 *
 * The TokenRefreshProvider registers a refresh callback that has the Apollo
 * client in scope; the error link and the scheduler both ask for `refresh()`
 * without needing access to React context.
 *
 * An in-flight refresh is memoized so concurrent consumers coalesce onto a
 * single network request instead of racing.
 */

import { useAuthStore } from "@/shared/stores/auth"

type RefreshFn = () => Promise<string | null>

let impl: RefreshFn | null = null
let inFlight: Promise<string | null> | null = null

export function registerRefresh(fn: RefreshFn | null) {
  impl = fn
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!impl) return null
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator?.locks?.request) {
        return await navigator.locks.request("vendor_auth_refresh", async () => {
          // Re-hydrate state from cookies to see if another tab already refreshed while we waited
          useAuthStore.getState().hydrate()
          const expiresAt = useAuthStore.getState().accessTokenExpiresAt
          const currentToken = useAuthStore.getState().accessToken
          if (expiresAt && currentToken) {
            const remainingMs = new Date(expiresAt).getTime() - Date.now()
            // If the token is valid for more than 60 seconds, adopt it rather than refetching
            if (remainingMs > 60_000) {
              return currentToken
            }
          }
          return await impl!()
        })
      }
      return await impl!()
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

