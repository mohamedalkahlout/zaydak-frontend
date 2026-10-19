import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_EXPIRES_COOKIE,
} from "@/shared/auth/cookie-names"
import { routeDecision } from "@/shared/auth/route-access"

/**
 * Route guard. The decision itself lives in `routeDecision` so it can be tested
 * without a request object; this file only translates it into a `NextResponse`.
 *
 * It reads the token's `role` claim but never verifies its signature, so it
 * remains a UX guard — the back-end authorizes every operation. What it does
 * guarantee is that a signed-in vendor or customer cannot land on the console.
 */

function clearSession(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_TOKEN_COOKIE)
  response.cookies.delete(ACCESS_EXPIRES_COOKIE)
  response.cookies.delete(REFRESH_TOKEN_COOKIE)
  response.cookies.delete(REFRESH_EXPIRES_COOKIE)
  return response
}

export function proxy(request: NextRequest) {
  const decision = routeDecision({
    pathname: request.nextUrl.pathname,
    token: request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    expired: request.nextUrl.searchParams.has("expired"),
  })

  switch (decision.type) {
    case "clear":
      return clearSession(NextResponse.next())
    case "redirect": {
      const response = NextResponse.redirect(new URL(decision.to, request.url))
      return decision.clearCookies ? clearSession(response) : response
    }
    case "next":
      return NextResponse.next()
  }
}

// Every authed route must be listed here. A route absent from the matcher is
// never seen by the guard, so it renders for a logged-out visitor instead of
// redirecting to /login.
export const config = {
  matcher: [
    "/",
    "/analytics/:path*",
    "/users/:path*",
    "/shops/:path*",
    "/withdrawals/:path*",
    "/commissions/:path*",
    "/payment-fees/:path*",
    "/plans/:path*",
    "/subscribers/:path*",
    "/integrations/:path*",
    "/otp-logs/:path*",
    "/moderation/:path*",
    "/settings/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
  ],
}
