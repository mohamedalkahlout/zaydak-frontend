"use client"

import { useEffect, useRef } from "react"
import { useApolloClient } from "@apollo/client/react"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import {
  registerApolloClient,
  registerClearApolloCache,
} from "./apollo-bridge"
import { registerRefresh } from "./refresh"
import { clearAuthSession, forceLogout } from "./session"
import { translatorFor } from "@/shared/i18n/outside-react"

/** The refresh token was replayed: every session is gone, say so and leave. */
async function forceLogoutAfterTokenReuse() {
  const t = await translatorFor("requestErrors")
  await forceLogout({
    title: t("suspiciousActivity.title"),
    description: t("suspiciousActivity.description"),
    redirectTo: "/login",
  })
}

const REFRESH_LEAD_MS = 60_000
// Floor to avoid busy-looping if the server clock is skewed ahead of ours.
const MIN_DELAY_MS = 5_000

interface RefreshResponse {
  success: boolean
  error_code?: string
  data?: {
    access_token: string
    access_token_expires_at?: string | null
    refresh_token_expires_at?: string | null
  }
}

export function TokenRefreshProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expiresAt = useAuthStore((s) => s.accessTokenExpiresAt)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const apollo = useApolloClient()

  useEffect(() => {
    useAuthStore.getState().hydrate()
    useActiveShopStore.getState().hydrate()
  }, [])

  useEffect(() => {
    registerClearApolloCache(async () => {
      await apollo.clearStore()
    })
    // The client itself, for the non-React callers that need to run an
    // operation rather than clear a cache — see `apollo-bridge.ts`.
    registerApolloClient(apollo)
    return () => {
      registerClearApolloCache(null)
      registerApolloClient(null)
    }
  }, [apollo])

  useEffect(() => {
    async function doRefresh(): Promise<string | null> {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        })
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as RefreshResponse | null
          if (json?.error_code === "TOKEN_REUSE_DETECTED") {
            await forceLogoutAfterTokenReuse()
            return null
          }
          if (json?.error_code === "TOKEN_ROTATED_RECENTLY") {
            useAuthStore.getState().hydrate()
            return useAuthStore.getState().accessToken
          }
          await clearAuthSession()
          return null
        }
        const json = (await res.json()) as RefreshResponse
        if (!json.success || !json.data?.access_token) {
          if (json.error_code === "TOKEN_REUSE_DETECTED") {
            await forceLogoutAfterTokenReuse()
            return null
          }
          if (json.error_code === "TOKEN_ROTATED_RECENTLY") {
            useAuthStore.getState().hydrate()
            return useAuthStore.getState().accessToken
          }
          await clearAuthSession()
          return null
        }
        setAccessToken(
          json.data.access_token,
          json.data.access_token_expires_at,
          json.data.refresh_token_expires_at,
        )
        return json.data.access_token
      } catch {
        await clearAuthSession()
        return null
      }
    }

    registerRefresh(doRefresh)
    return () => registerRefresh(null)
  }, [setAccessToken])

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!expiresAt || !isAuthenticated) return

    const expiresMs = Date.parse(expiresAt)
    if (Number.isNaN(expiresMs)) return
    const delay = Math.max(expiresMs - Date.now() - REFRESH_LEAD_MS, MIN_DELAY_MS)

    timerRef.current = setTimeout(async () => {
      const { refreshAccessToken } = await import("./refresh")
      await refreshAccessToken()
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [expiresAt, isAuthenticated])

  return <>{children}</>
}
