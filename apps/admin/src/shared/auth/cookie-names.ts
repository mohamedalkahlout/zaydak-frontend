/**
 * Cookie keys for the admin console.
 *
 * Deliberately dependency-free so `proxy.ts` (Edge runtime), the route
 * handlers, and client code can all import the same constants.
 *
 * They are prefixed `admin_` because **cookies are not isolated by port**
 * (RFC 6265 §8.5). The vendor dashboard on `localhost:3001` and this console on
 * `localhost:3002` share one cookie jar, so reusing the name `access_token`
 * meant a vendor who signed in on the dashboard arrived here already
 * "authenticated". The same collision would hit any two apps deployed under one
 * apex domain.
 *
 * The prefix also stops this app's logout from clearing the vendor's session.
 */

export const ACCESS_TOKEN_COOKIE = "admin_access_token"
export const ACCESS_EXPIRES_COOKIE = "admin_access_token_expires_at"
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token"
export const REFRESH_EXPIRES_COOKIE = "admin_refresh_token_expires_at"
