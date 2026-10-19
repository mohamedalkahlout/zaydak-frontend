import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_EXPIRES_COOKIE,
  ACTIVE_SHOP_COOKIE,
} from "@/shared/lib/auth/cookies"
import { isSameOrigin } from "@/shared/lib/auth/origin"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/graphql"

const LOGOUT_MUTATION = /* GraphQL */ `
  mutation Logout($token: String!) {
    logout(token: $token) {
      success
    }
  }
`

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const jar = await cookies()
  const refresh = jar.get(REFRESH_TOKEN_COOKIE)?.value

  if (refresh) {
    const hdrs = await headers()
    const locale = hdrs.get("accept-language") ?? "en"
    try {
      await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": locale,
          ...tunnelHeaders(GRAPHQL_URL),
        },
        body: JSON.stringify({
          query: LOGOUT_MUTATION,
          variables: { token: refresh },
        }),
        cache: "no-store",
      })
    } catch {
      // Server errors on logout shouldn't block the local cleanup —
      // the user clicked "log out" and expects to be signed out.
    }
  }

  jar.delete(REFRESH_TOKEN_COOKIE)
  jar.delete(ACCESS_TOKEN_COOKIE)
  jar.delete(ACCESS_EXPIRES_COOKIE)
  jar.delete(REFRESH_EXPIRES_COOKIE)
  // Drop the previous user's shop scope so the next session doesn't inherit it.
  jar.delete(ACTIVE_SHOP_COOKIE)

  return NextResponse.json({ success: true })
}
