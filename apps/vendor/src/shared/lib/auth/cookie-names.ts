/**
 * Shared cookie + localStorage keys used by auth and shop scoping.
 *
 * Kept dependency-free so middleware (Edge runtime), server-only Apollo,
 * and client code can all import the same constants.
 */

export const ACCESS_TOKEN_COOKIE = "access_token"
export const ACCESS_EXPIRES_COOKIE = "access_token_expires_at"
export const REFRESH_TOKEN_COOKIE = "refresh_token"
export const REFRESH_EXPIRES_COOKIE = "refresh_token_expires_at"

// Same string is reused as the localStorage key on the client so the
// active-shop store and the middleware-written cookie stay in lockstep.
export const ACTIVE_SHOP_KEY = "active_shop_slug"

export const LOCALE_COOKIE = "locale"
export const DEFAULT_LOCALE = "en"
