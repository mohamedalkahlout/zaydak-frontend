import { isAdminRole } from "./roles"
import { readRoleFromToken } from "./jwt"

/** Routes reachable without a session. */
export const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
] as const

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export type Decision =
  /** Serve the request unchanged. */
  | { type: "next" }
  /** Serve the request, but drop this app's session cookies first. */
  | { type: "clear" }
  /** Send the visitor somewhere else. `clearCookies` drops the stale jar too. */
  | { type: "redirect"; to: string; clearCookies: boolean }

interface Input {
  pathname: string
  /** This app's access-token cookie, if present. */
  token: string | undefined
  /** The `?expired` marker the Apollo error link appends on a failed refresh. */
  expired: boolean
}

/**
 * The whole route guard, as a pure function.
 *
 * Note what it is *not*: it never verifies the token's signature, so it is a UX
 * guard rather than a security boundary. The back-end authorizes every
 * operation. Its job is to stop a signed-in non-admin from landing on a console
 * they cannot use — which is exactly what happened when the vendor dashboard and
 * this app shared the cookie name `access_token`.
 */
export function routeDecision({ pathname, token, expired }: Input): Decision {
  const publicPath = isPublicPath(pathname)

  // Upstream rejected the token — clear the jar and let the user reach /login.
  if (token && publicPath && expired) {
    return { type: "clear" }
  }

  if (token) {
    // A token belonging to a vendor or a customer is treated as no token at
    // all, and the stale jar is dropped so it cannot keep bouncing the guard.
    if (!isAdminRole(readRoleFromToken(token))) {
      return publicPath
        ? { type: "clear" }
        : { type: "redirect", to: "/login?forbidden=1", clearCookies: true }
    }

    if (publicPath) {
      return { type: "redirect", to: "/users", clearCookies: false }
    }
    return { type: "next" }
  }

  if (!publicPath) {
    return {
      type: "redirect",
      to: `/login?redirect=${encodeURIComponent(pathname)}`,
      clearCookies: false,
    }
  }

  return { type: "next" }
}
