import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  ACCESS_TOKEN_COOKIE,
  ACTIVE_SHOP_KEY,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/lib/auth/cookie-names"
import { SHOP_SCOPED_PREFIXES, shopSlugOfPath } from "@/shared/lib/shop-path"

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
]

// `/theme-preview` renders a storefront template full screen, outside the
// dashboard shell (a template owns the window's scroll), so it is not under `/store`.
const PROTECTED_PREFIXES = ["/store", "/shops", "/create-store", "/plan", "/theme-preview"]

/**
 * The request path, forwarded into the server tree.
 *
 * A layout is handed only its own dynamic params, and
 * `store/[shopSlug]/layout.tsx` needs the whole path to send a retired handle
 * to the current one **without dropping the page that was asked for** —
 * `/store/old/products/mug` has to land on `/store/new/products/mug`, not on
 * `/store/new`. Middleware is the only place that sees both.
 */
export const PATHNAME_HEADER = "x-vendor-pathname"

const ACTIVE_SHOP_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const isPublicAuthPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Token was invalidated upstream — clear cookies and let user through to login
  const forceLogout =
    request.nextUrl.searchParams.has("expired") ||
    request.nextUrl.searchParams.has("denied")
  if (token && isPublicAuthPath && forceLogout) {
    const response = NextResponse.next()
    response.cookies.delete(ACCESS_TOKEN_COOKIE)
    response.cookies.delete(REFRESH_TOKEN_COOKIE)
    response.cookies.delete(ACTIVE_SHOP_KEY)
    return response
  }

  // Authenticated user trying to visit auth pages → redirect to dashboard
  if (token && isPublicAuthPath) {
    return NextResponse.redirect(new URL("/store", request.url))
  }

  // Unauthenticated user trying to visit protected pages → redirect to login
  if (!token && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Shop-scoped routes: sync `/{prefix}/{slug}/...` into a cookie so
  // server-side Apollo (which has no window/localStorage) can inject the
  // X-SHOP header. Static screens such as `/store/change-password` name no
  // shop, so `shopSlugOfPath` answers null for them and the cookie is kept.
  const scoped = SHOP_SCOPED_PREFIXES.some((p) => pathname.startsWith(p))
  if (scoped) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(PATHNAME_HEADER, pathname)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")

    const slug = shopSlugOfPath(pathname)
    const current = request.cookies.get(ACTIVE_SHOP_KEY)?.value
    if (slug && slug !== current) {
      response.cookies.set(ACTIVE_SHOP_KEY, slug, {
        path: "/",
        sameSite: "lax",
        maxAge: ACTIVE_SHOP_COOKIE_MAX_AGE,
      })
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/store/:path*",
    "/plan/:path*",
    "/theme-preview/:path*",
    "/shops",
    "/create-store",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
  ],
}
