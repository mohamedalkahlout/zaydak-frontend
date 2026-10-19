import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { refreshCookie } from "@/shared/auth/cookies"
import {
  deleteSession,
  dropFromIndex,
  isSameOrigin,
  shopParam,
  touchIndex,
  writeSession,
} from "@/shared/auth/session-jar"
import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

const REFRESH_MUTATION = /* GraphQL */ `
  mutation RefreshCustomerSession($token: String!) {
    refreshCustomerSession(token: $token) {
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
 * Exchanges one shop's httpOnly refresh cookie for a new token pair. Runs
 * server-side so the refresh token is never handed to client JS.
 *
 * The shop arrives as `?shop=` for the same reason it does on the session
 * route: this handler lives outside every shop segment and cannot read the
 * scope from its own URL.
 *
 * The session is the shop's customer's own (`customer_sessions`), and the
 * mutation takes a bare token: the customer — and so the shop — rides on the
 * row, so a rotation cannot move the session to another shop. A refresh
 * token minted before customers signed in as themselves (an account's) is
 * unknown there, so it fails here and the visitor signs in with their number.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const slug = shopParam(req)
  if (!slug) {
    return NextResponse.json(
      { success: false, error_code: "MISSING_SHOP" },
      { status: 400 },
    )
  }

  const jar = await cookies()
  const currentRefresh = jar.get(refreshCookie(slug))?.value
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
    data?: {
      refreshCustomerSession?: { success: boolean; data?: RefreshResult }
    }
    errors?: Array<{ extensions?: { error_code?: string; code?: string } }>
  } | null

  const first = payload?.errors?.[0]
  const code = first?.extensions?.error_code ?? first?.extensions?.code
  const data = payload?.data?.refreshCustomerSession?.data

  if (first || !data) {
    // This shop's four names and nothing else. Clearing the whole jar here
    // would mean one storefront's expired refresh token signing the visitor out
    // of every other storefront — the exact bug per-shop sessions exist to
    // prevent, reintroduced through the error path.
    // If the token was already rotated in a concurrent race, leave the cookies intact.
    if (code !== "TOKEN_ROTATED_RECENTLY") {
      deleteSession(jar, slug)
      dropFromIndex(jar, slug)
    }
    return NextResponse.json(
      { success: false, error_code: code ?? "REFRESH_FAILED" },
      { status: 401 },
    )
  }

  writeSession(jar, slug, data)
  // `touchIndex`, never `touchIndexAndEvict`: a rotation updates recency and
  // must not delete another shop's cookies.
  touchIndex(jar, slug)

  return NextResponse.json({
    success: true,
    data: {
      access_token: data.access_token,
      access_token_expires_at: data.access_token_expires_at ?? null,
    },
  })
}
