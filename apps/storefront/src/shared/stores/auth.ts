import { create } from "zustand"
import { getCookie } from "@/shared/lib/cookies"
import {
  accessCookie,
  accessExpiresCookie,
  refreshExpiresCookie,
} from "@/shared/auth/cookie-names"

/**
 * Auth state for the customer storefront: the tokens **and** who they belong
 * to, **per shop**.
 *
 * A session is minted for one storefront and authorizes nothing at the next, so
 * this store holds a slice per shop rather than one session. The back-end is
 * what enforces that — the access token carries a `shop_id` claim and
 * `ShopHeaderGuard` refuses a mismatch — and keying the store the same way is
 * what makes `/beta` render a sign-in form instead of looking signed in and
 * failing on the first mutation.
 *
 * The slices are kept, not cleared, when a visitor walks from one shop to
 * another: this is module-level state that survives client-side routing, and
 * two tabs on two storefronts are an ordinary thing to have open.
 *
 * The refresh token lives in an httpOnly cookie written by `/api/auth/*` and is
 * never held here. The access token is mirrored in a short-lived readable
 * cookie so `hydrate()` can restore it after a reload.
 *
 * The `user` half is what stops the profile being re-fetched by every screen that
 * needs a name. Apollo is still the *fetcher* — `useCurrentUser` owns the one
 * `MY_PROFILE` query and mirrors its result in here — but this store is the single
 * place anything reads it from, so the header, the account hub and the checkout
 * form all answer "who is signed in" identically and without a second request.
 *
 * `userStatus` exists because `user === null` is genuinely ambiguous: signed
 * out, or signed in and the profile has not landed yet. A header that cannot
 * tell those apart flashes "Sign in" at someone who is already signed in.
 */

interface AuthTokens {
  access_token: string
  refresh_token: string
  access_token_expires_at?: string | null
  refresh_token_expires_at?: string | null
}

/**
 * The shop's customer signed in here — never a platform account. What
 * `myCustomerProfile` returns, and nothing else: a field this store holds is a
 * field something is expected to read.
 */
export interface CurrentUser {
  id: string
  /** Null until the customer gives one. */
  name: string | null
  /** E.164: the number the customer signs in with. */
  phone_e164: string | null
  /** For receipts and updates only; never a sign-in. */
  email: string | null
}

/**
 * `idle`    — no session to load a profile for.
 * `loading` — there is a token and the profile is in flight.
 * `ready`   — the profile has answered (`user` may still be null if it failed).
 */
export type UserStatus = "idle" | "loading" | "ready"

/** One shop's session. */
export interface ShopSession {
  accessToken: string | null
  accessTokenExpiresAt: string | null
  isAuthenticated: boolean
  user: CurrentUser | null
  userStatus: UserStatus
}

/**
 * Frozen and module-level so the selector for a shop with no session returns a
 * referentially stable value. A fresh object literal there would re-render
 * every component reading an unknown shop on every unrelated write.
 */
export const EMPTY_SESSION: ShopSession = Object.freeze({
  accessToken: null,
  accessTokenExpiresAt: null,
  isAuthenticated: false,
  user: null,
  userStatus: "idle",
})

interface AuthState {
  sessions: Record<string, ShopSession>
  /** True once `hydrate` has settled for `hydratedFor`. */
  hydrated: boolean
  /**
   * *Which* shop was hydrated. A bare boolean cannot stop shop B's header
   * answering "signed out" from a store that has only ever read shop A's
   * cookie.
   */
  hydratedFor: string | null

  setTokens: (slug: string, tokens: AuthTokens) => Promise<void>
  setAccessToken: (
    slug: string,
    token: string,
    expiresAt?: string | null,
  ) => void
  setUser: (slug: string, user: CurrentUser | null) => void
  setUserStatus: (slug: string, status: UserStatus) => void
  /** Local reset for one shop. Callers must also hit `/api/auth/session`. */
  clearTokens: (slug: string) => void
  clearAllSessions: () => void
  hydrate: (slug: string | null) => void
}

function merge(
  state: AuthState,
  slug: string,
  patch: Partial<ShopSession>,
): Record<string, ShopSession> {
  return {
    ...state.sessions,
    [slug]: { ...(state.sessions[slug] ?? EMPTY_SESSION), ...patch },
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  sessions: {},
  hydrated: false,
  hydratedFor: null,

  setTokens: async (slug, tokens) => {
    const res = await fetch(
      `/api/auth/session?shop=${encodeURIComponent(slug)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tokens),
        credentials: "same-origin",
      },
    )
    if (!res.ok) throw new Error("Failed to persist session")

    set((s) => ({
      sessions: {
        ...s.sessions,
        [slug]: {
          accessToken: tokens.access_token,
          accessTokenExpiresAt: tokens.access_token_expires_at ?? null,
          isAuthenticated: true,
          // A different account may be signing in over the top of this one, so
          // the previous profile is dropped rather than left to be overwritten
          // when the next profile lands — one render showing the old name would be
          // a leak.
          user: null,
          userStatus: "loading",
        },
      },
      hydrated: true,
      hydratedFor: slug,
    }))
  },

  setAccessToken: (slug, accessToken, accessTokenExpiresAt) =>
    set((s) => ({
      sessions: merge(s, slug, {
        accessToken,
        accessTokenExpiresAt: accessTokenExpiresAt ?? null,
        isAuthenticated: !!accessToken,
      }),
      hydrated: true,
      hydratedFor: slug,
    })),

  setUser: (slug, user) =>
    set((s) => ({ sessions: merge(s, slug, { user, userStatus: "ready" }) })),

  setUserStatus: (slug, userStatus) =>
    set((s) => ({ sessions: merge(s, slug, { userStatus }) })),

  clearTokens: (slug) =>
    set((s) => ({
      sessions: { ...s.sessions, [slug]: EMPTY_SESSION },
      hydrated: true,
      hydratedFor: slug,
    })),

  clearAllSessions: () =>
    set({ sessions: {}, hydrated: true, hydratedFor: null }),

  hydrate: (slug) => {
    if (!slug) {
      // `/` — the shop directory. No scope, so there is nothing to restore.
      set({ hydrated: true, hydratedFor: null })
      return
    }

    const accessToken = getCookie(accessCookie(slug))
    if (accessToken) {
      set((s) => ({
        sessions: {
          ...s.sessions,
          [slug]: {
            ...EMPTY_SESSION,
            accessToken,
            accessTokenExpiresAt: getCookie(accessExpiresCookie(slug)),
            isAuthenticated: true,
            userStatus: "loading",
          },
        },
        hydrated: true,
        hydratedFor: slug,
      }))
      return
    }

    // No access cookie, but the refresh cookie may still be live.
    //
    // The access cookie lasts an hour and the refresh cookie seven days, and
    // nothing in this app ever spent the difference: `refreshAccessToken` is
    // only reachable from the error link's TOKEN_EXPIRED branch, which needs a
    // request carrying a token, which needs an access cookie. So a reload an
    // hour after the last one silently signed the shopper out with six days of
    // session left. Per-shop sessions would have multiplied that by the number
    // of shops a visitor uses, so the readable refresh-expiry cookie — written
    // by both handlers and, until now, read by nothing — finally has a reader.
    const refreshExpires = getCookie(refreshExpiresCookie(slug))
    if (refreshExpires && Date.parse(refreshExpires) > Date.now()) {
      // `hydrated` deliberately stays false for this shop, so the header shows
      // its neutral pre-hydration state rather than flashing "Sign in".
      // `setAccessToken` and `clearTokens` both settle it.
      //
      // A dynamic import because `refresh.ts` imports this store — a static one
      // would be a cycle.
      void import("@/shared/auth/refresh").then(({ refreshAccessToken }) =>
        refreshAccessToken(slug).then((token) => {
          if (!token) useAuthStore.getState().clearTokens(slug)
        }),
      )
      return
    }

    set((s) => ({
      sessions: { ...s.sessions, [slug]: EMPTY_SESSION },
      hydrated: true,
      hydratedFor: slug,
    }))
  },
}))

/** One shop's session, reactively. */
export function useShopSession(slug: string | null): ShopSession {
  return useAuthStore((s) =>
    slug ? (s.sessions[slug] ?? EMPTY_SESSION) : EMPTY_SESSION,
  )
}

/** One shop's session, read once — for non-React callers (links, fetch helpers). */
export function shopSessionOf(slug: string | null): ShopSession {
  return slug
    ? (useAuthStore.getState().sessions[slug] ?? EMPTY_SESSION)
    : EMPTY_SESSION
}
