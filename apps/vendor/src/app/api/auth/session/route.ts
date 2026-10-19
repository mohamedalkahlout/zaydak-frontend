import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_EXPIRES_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_EXPIRES_COOKIE,
  ACTIVE_SHOP_COOKIE,
  accessCookieOptions,
  expiryCookieOptions,
  refreshCookieOptions,
} from "@/shared/lib/auth/cookies"
import { isSameOrigin } from "@/shared/lib/auth/origin"

interface SessionPayload {
  access_token: string
  access_token_expires_at?: string | null
  refresh_token: string
  refresh_token_expires_at?: string | null
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as SessionPayload | null
  if (!body?.access_token || !body?.refresh_token) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  const jar = await cookies()
  jar.set(REFRESH_TOKEN_COOKIE, body.refresh_token, refreshCookieOptions())
  jar.set(ACCESS_TOKEN_COOKIE, body.access_token, accessCookieOptions())

  if (body.access_token_expires_at) {
    jar.set(
      ACCESS_EXPIRES_COOKIE,
      body.access_token_expires_at,
      expiryCookieOptions(),
    )
  } else {
    jar.delete(ACCESS_EXPIRES_COOKIE)
  }

  if (body.refresh_token_expires_at) {
    jar.set(
      REFRESH_EXPIRES_COOKIE,
      body.refresh_token_expires_at,
      expiryCookieOptions(),
    )
  } else {
    jar.delete(REFRESH_EXPIRES_COOKIE)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const jar = await cookies()
  jar.delete(REFRESH_TOKEN_COOKIE)
  jar.delete(ACCESS_TOKEN_COOKIE)
  jar.delete(ACCESS_EXPIRES_COOKIE)
  jar.delete(REFRESH_EXPIRES_COOKIE)
  // Drop the previous user's shop scope so the next session doesn't inherit it.
  jar.delete(ACTIVE_SHOP_COOKIE)
  return NextResponse.json({ success: true })
}
