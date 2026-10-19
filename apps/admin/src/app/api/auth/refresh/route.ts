import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_EXPIRES_COOKIE,
  accessCookieOptions,
  expiryCookieOptions,
  refreshCookieOptions,
} from "@/shared/auth/cookies"
import { isSameOrigin } from "@/shared/auth/origin"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/graphql"

const REFRESH_MUTATION = /* GraphQL */ `
  mutation RefreshToken($token: String!) {
    refreshToken(token: $token) {
      success
      data {
        access_token
        access_token_expires_at
        refresh_token
        refresh_token_expires_at
      }
    }
  }
`

interface RefreshResult {
  access_token: string
  access_token_expires_at?: string | null
  refresh_token: string
  refresh_token_expires_at?: string | null
}

/**
 * Exchanges the httpOnly refresh cookie for a new token pair. Runs server-side
 * so the refresh token is never handed to client JS. Any failure clears the
 * whole jar — a stale refresh cookie must not survive a rejected rotation.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const jar = await cookies()
  const currentRefresh = jar.get(REFRESH_TOKEN_COOKIE)?.value
  if (!currentRefresh) {
    return NextResponse.json(
      { success: false, error_code: "NO_REFRESH_TOKEN" },
      { status: 401 },
    )
  }

  let response: Response
  try {
    response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
      },
      body: JSON.stringify({
        query: REFRESH_MUTATION,
        variables: { token: currentRefresh },
      }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json(
      { success: false, error_code: "NETWORK_ERROR" },
      { status: 502 },
    )
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { refreshToken?: { success: boolean; data?: RefreshResult } }
    errors?: Array<{ extensions?: { error_code?: string; code?: string } }>
  } | null

  const first = payload?.errors?.[0]
  const code = first?.extensions?.error_code ?? first?.extensions?.code
  const data = payload?.data?.refreshToken?.data

  if (first || !data) {
    jar.delete(REFRESH_TOKEN_COOKIE)
    jar.delete(ACCESS_TOKEN_COOKIE)
    jar.delete(ACCESS_EXPIRES_COOKIE)
    jar.delete(REFRESH_EXPIRES_COOKIE)
    return NextResponse.json(
      { success: false, error_code: code ?? "REFRESH_FAILED" },
      { status: 401 },
    )
  }

  jar.set(REFRESH_TOKEN_COOKIE, data.refresh_token, refreshCookieOptions())
  jar.set(ACCESS_TOKEN_COOKIE, data.access_token, accessCookieOptions())
  if (data.access_token_expires_at) {
    jar.set(ACCESS_EXPIRES_COOKIE, data.access_token_expires_at, expiryCookieOptions())
  }
  if (data.refresh_token_expires_at) {
    jar.set(REFRESH_EXPIRES_COOKIE, data.refresh_token_expires_at, expiryCookieOptions())
  }

  return NextResponse.json({
    success: true,
    data: {
      access_token: data.access_token,
      access_token_expires_at: data.access_token_expires_at ?? null,
    },
  })
}
