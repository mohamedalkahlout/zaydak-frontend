import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { LEGACY_SESSION_COOKIES, MAX_SHOP_SESSIONS } from "@/shared/auth/cookie-names"
import { refreshCookie } from "@/shared/auth/cookies"
import {
  deleteAllSessions,
  deleteSession,
  dropFromIndex,
  isSameOrigin,
  readIndex,
  shopParam,
  touchIndexAndEvict,
  writeSession,
} from "@/shared/auth/session-jar"
import { revokeRefreshToken } from "@/shared/auth/logout-upstream"

/**
 * Write and clear a storefront session — **one shop's session**.
 *
 * The shop arrives as `?shop=`, not in the body. These handlers sit at
 * `/api/auth/*`, outside every shop segment, so they are the one part of this
 * app that cannot read the scope out of its own URL; the query string is the
 * single channel a body-less `DELETE` and the body-less refresh `POST` both
 * support, so there are never two sources that can disagree.
 */

interface SessionPayload {
  access_token: string
  access_token_expires_at?: string | null
  refresh_token: string
  refresh_token_expires_at?: string | null
}

/** Persist a fresh sign-in: refresh token goes httpOnly, access token stays readable. */
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

  const body = (await req.json().catch(() => null)) as SessionPayload | null
  if (!body?.access_token || !body?.refresh_token) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  const jar = await cookies()
  writeSession(jar, slug, body)

  // Eviction belongs to the sign-in path alone. It deletes another shop's
  // cookies, and a background rotation must never be able to sign a visitor out
  // of a tab they left open on a different storefront.
  const evicted = touchIndexAndEvict(jar, slug)
  if (evicted.length) {
    console.warn(
      `[auth] signed out of ${evicted.join(", ")} — a browser holds at most ${MAX_SHOP_SESSIONS} shop sessions`,
    )
  }

  return NextResponse.json({ success: true })
}

/**
 * Sign out.
 *
 * With `?shop=`, this shop only — the visitor stays signed in everywhere else.
 * Without it, every shop in this browser.
 *
 * Either way the refresh token is revoked upstream first. Clearing cookies
 * alone would leave the row live for its full seven days, so the session the
 * visitor believes they closed would still be redeemable.
 */
export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false }, { status: 403 })
  }

  const jar = await cookies()
  const slug = shopParam(req)
  const targets = slug ? [slug] : readIndex(jar)

  await Promise.all(
    targets.map(async (target) => {
      const token = jar.get(refreshCookie(target))?.value
      if (token) await revokeRefreshToken(token)
    }),
  )

  if (slug) {
    deleteSession(jar, slug)
    dropFromIndex(jar, slug)
  } else {
    // Sweeps any session cookie whose slug fell out of the index too.
    deleteAllSessions(jar)
  }

  // The flat names this app wrote before sessions were per-shop. Deleted on
  // every sign-out so a dead jar cannot ride along for seven days.
  for (const name of LEGACY_SESSION_COOKIES) jar.delete(name)

  return NextResponse.json({ success: true })
}
