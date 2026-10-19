import "server-only"

import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"

/**
 * Cookie options for the `/api/auth/*` routes.
 *
 * `refresh_token` is httpOnly — client JS must never read it. The access token
 * and its expiry are readable by the browser so Apollo can attach
 * `Authorization` after a reload without a server round-trip.
 *
 * These factories stay **argument-free** and `baseOptions()` keeps `path: "/"`,
 * even though a session now belongs to one shop. That is the payoff of scoping
 * by cookie *name*: only the `jar.set(name, ...)` call sites had to learn about
 * shops. A `path`-scoped cookie would be unreadable by `/api/auth/refresh`
 * (which lives outside every shop segment) and undeletable by `removeCookie`
 * (which writes at `path=/`).
 */

export {
  shopCookieKey,
  accessCookie,
  accessExpiresCookie,
  refreshCookie,
  refreshExpiresCookie,
  sessionCookieNames,
  SESSION_COOKIE_RE,
  SESSION_INDEX_COOKIE,
  MAX_SHOP_SESSIONS,
  LEGACY_SESSION_COOKIES,
} from "./cookie-names"

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60
const ONE_HOUR_SECONDS = 60 * 60

const isProd = () => process.env.NODE_ENV === "production"

function baseOptions(): Omit<ResponseCookie, "name" | "value"> {
  return {
    path: "/",
    sameSite: "lax",
    secure: isProd(),
  }
}

export function refreshCookieOptions(): Omit<ResponseCookie, "name" | "value"> {
  return { ...baseOptions(), httpOnly: true, maxAge: SEVEN_DAYS_SECONDS }
}

export function accessCookieOptions(): Omit<ResponseCookie, "name" | "value"> {
  return { ...baseOptions(), httpOnly: false, maxAge: ONE_HOUR_SECONDS }
}

export function expiryCookieOptions(): Omit<ResponseCookie, "name" | "value"> {
  return { ...baseOptions(), httpOnly: false, maxAge: SEVEN_DAYS_SECONDS }
}

/**
 * The session index — which shops currently hold a session, most recent first.
 *
 * httpOnly: nothing client-side needs to enumerate a visitor's shops, and a
 * readable list of every storefront somebody is signed into is a cross-shop
 * correlator this change has no reason to create.
 */
export function sessionIndexCookieOptions(): Omit<
  ResponseCookie,
  "name" | "value"
> {
  return { ...baseOptions(), httpOnly: true, maxAge: SEVEN_DAYS_SECONDS }
}
