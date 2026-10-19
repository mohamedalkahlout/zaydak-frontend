"use client"

import { useAuthStore } from "@/shared/stores/auth"

/**
 * Rotates one shop's token pair through `/api/auth/refresh`.
 *
 * **Concurrent callers for the same shop share one in-flight request.** Several
 * queries can fail with TOKEN_EXPIRED at the same moment, and firing a refresh
 * per query would burn the rotating refresh token and trip the back-end's reuse
 * detection — which revokes the whole `family_id`, signing the shopper out
 * rather than refreshing them.
 *
 * **The dedupe is per shop, and that is equally necessary.** A single shared
 * promise would hand shop A's rotated token to a caller waiting on shop B, so
 * the map is keyed by slug rather than being one module-level variable.
 *
 * The mutation behind the route takes a bare token: the customer, and so the
 * shop, lives on the `customer_sessions` row, so rotation preserves it with
 * nothing to send.
 */
const inFlight = new Map<string, Promise<string | null>>()

async function executeRefresh(slug: string): Promise<string | null> {
  const res = await fetch(
    `/api/auth/refresh?shop=${encodeURIComponent(slug)}`,
    {
      method: "POST",
      credentials: "same-origin",
    },
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error_code?: string
    } | null
    if (json?.error_code === "TOKEN_ROTATED_RECENTLY") {
      useAuthStore.getState().hydrate(slug)
      return useAuthStore.getState().sessions[slug]?.accessToken ?? null
    }
    return null
  }

  const json = (await res.json()) as {
    success: boolean
    error_code?: string
    data?: { access_token: string; access_token_expires_at?: string | null }
  }
  if (!json.success || !json.data) {
    if (json.error_code === "TOKEN_ROTATED_RECENTLY") {
      useAuthStore.getState().hydrate(slug)
      return useAuthStore.getState().sessions[slug]?.accessToken ?? null
    }
    return null
  }

  useAuthStore
    .getState()
    .setAccessToken(
      slug,
      json.data.access_token,
      json.data.access_token_expires_at,
    )
  return json.data.access_token
}

export function refreshAccessToken(slug: string): Promise<string | null> {
  const existing = inFlight.get(slug)
  if (existing) return existing

  const request = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator?.locks?.request) {
        return await navigator.locks.request(
          `sf_auth_refresh_${slug}`,
          async () => {
            useAuthStore.getState().hydrate(slug)
            const session = useAuthStore.getState().sessions[slug]
            if (session?.accessToken && session.accessTokenExpiresAt) {
              const remainingMs =
                new Date(session.accessTokenExpiresAt).getTime() - Date.now()
              if (remainingMs > 60_000) {
                return session.accessToken
              }
            }
            return await executeRefresh(slug)
          },
        )
      }
      return await executeRefresh(slug)
    } catch {
      return null
    } finally {
      inFlight.delete(slug)
    }
  })()

  inFlight.set(slug, request)
  return request
}
