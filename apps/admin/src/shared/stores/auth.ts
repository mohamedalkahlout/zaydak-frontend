import { create } from "zustand"
import { getCookie } from "@/shared/lib/cookies"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
} from "@/shared/auth/cookie-names"

/**
 * Auth token state for the admin console.
 *
 * The refresh token lives in an httpOnly cookie written by `/api/auth/*` and is
 * never held here. The access token is mirrored in a short-lived readable
 * cookie so `hydrate()` can restore it after a reload.
 */

interface AuthTokens {
  access_token: string
  refresh_token: string
  access_token_expires_at?: string | null
  refresh_token_expires_at?: string | null
}

interface AuthState {
  accessToken: string | null
  accessTokenExpiresAt: string | null
  isAuthenticated: boolean

  setTokens: (tokens: AuthTokens) => Promise<void>
  setAccessToken: (token: string, expiresAt?: string | null) => void
  /** Local reset only. Callers must also hit `/api/auth/session` to clear cookies. */
  clearTokens: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accessTokenExpiresAt: null,
  isAuthenticated: false,

  setTokens: async (tokens) => {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tokens),
      credentials: "same-origin",
    })
    if (!res.ok) throw new Error("Failed to persist session")

    set({
      accessToken: tokens.access_token,
      accessTokenExpiresAt: tokens.access_token_expires_at ?? null,
      isAuthenticated: true,
    })
  },

  setAccessToken: (accessToken, accessTokenExpiresAt) =>
    set({
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt ?? null,
      isAuthenticated: !!accessToken,
    }),

  clearTokens: () =>
    set({ accessToken: null, accessTokenExpiresAt: null, isAuthenticated: false }),

  hydrate: () => {
    const accessToken = getCookie(ACCESS_TOKEN_COOKIE)
    set({
      accessToken,
      accessTokenExpiresAt: getCookie(ACCESS_EXPIRES_COOKIE),
      isAuthenticated: !!accessToken,
    })
  },
}))
