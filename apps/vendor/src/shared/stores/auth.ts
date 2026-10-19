import { create } from "zustand"
import { getCookie } from "@/shared/lib/cookies"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
  REFRESH_EXPIRES_COOKIE,
} from "@/shared/lib/auth/cookie-names"

/**
 * Auth token state.
 *
 * The refresh token lives in an **httpOnly** cookie set by `/api/auth/*`
 * routes — it is never exposed to client JS. The access token is mirrored
 * in a non-httpOnly cookie (short TTL) so SSR apollo + Zustand can read it,
 * plus in-memory here for client-side Apollo calls.
 *
 * `setTokens` pipes the full payload received from login/register through
 * `/api/auth/session`, which strips the refresh token onto an httpOnly
 * cookie and returns. The hook never keeps the refresh token in memory.
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
  refreshTokenExpiresAt: string | null
  isAuthenticated: boolean

  setTokens: (tokens: AuthTokens) => Promise<void>
  setAccessToken: (
    accessToken: string,
    accessTokenExpiresAt?: string | null,
    refreshTokenExpiresAt?: string | null,
  ) => void
  /** Reset auth state locally. Callers must hit an /api/auth/* route to
   *  also clear cookies + revoke the server session. */
  clearTokens: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  isAuthenticated: false,

  setTokens: async (tokens) => {
    // Route sets httpOnly refresh cookie + access/expiry cookies.
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tokens),
      credentials: "same-origin",
    })
    if (!res.ok) {
      throw new Error("Failed to persist session")
    }
    set({
      accessToken: tokens.access_token,
      accessTokenExpiresAt: tokens.access_token_expires_at ?? null,
      refreshTokenExpiresAt: tokens.refresh_token_expires_at ?? null,
      isAuthenticated: true,
    })
  },

  setAccessToken: (accessToken, accessTokenExpiresAt, refreshTokenExpiresAt) => {
    set({
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: refreshTokenExpiresAt ?? null,
      isAuthenticated: !!accessToken,
    })
  },

  clearTokens: () => {
    useActiveShopStore.getState().clear()
    set({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      isAuthenticated: false,
    })
  },

  hydrate: () => {
    const accessToken = getCookie(ACCESS_TOKEN_COOKIE)
    set({
      accessToken,
      accessTokenExpiresAt: getCookie(ACCESS_EXPIRES_COOKIE),
      refreshTokenExpiresAt: getCookie(REFRESH_EXPIRES_COOKIE),
      isAuthenticated: !!accessToken,
    })
  },
}))
