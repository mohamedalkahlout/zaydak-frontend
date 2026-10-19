"use client"

import { useAuthStore } from "@/shared/stores/auth"

/**
 * Rotates the token pair through `/api/auth/refresh`.
 *
 * Concurrent callers share one in-flight request — several queries can fail with
 * TOKEN_EXPIRED at the same moment, and firing a refresh per query would burn
 * the rotating refresh token and trip the back-end's reuse detection.
 */
let inFlight: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      })
      if (!res.ok) return null

      const json = (await res.json()) as {
        success: boolean
        data?: { access_token: string; access_token_expires_at?: string | null }
      }
      if (!json.success || !json.data) return null

      useAuthStore
        .getState()
        .setAccessToken(json.data.access_token, json.data.access_token_expires_at)
      return json.data.access_token
    } catch {
      return null
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
