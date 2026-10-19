import "server-only"

import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"

/**
 * Cookie options for the `/api/auth/*` routes.
 *
 * `refresh_token` is httpOnly — client JS must never read it. The access token
 * and its expiry are readable by the browser so Apollo can attach
 * `Authorization` after a reload without a server round-trip.
 */

export {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_EXPIRES_COOKIE,
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
