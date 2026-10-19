import "server-only"

import type { cookies } from "next/headers"
import {
  MAX_SHOP_SESSIONS,
  SESSION_COOKIE_RE,
  SESSION_INDEX_COOKIE,
  accessCookie,
  accessExpiresCookie,
  refreshCookie,
  refreshExpiresCookie,
  sessionCookieNames,
  accessCookieOptions,
  expiryCookieOptions,
  refreshCookieOptions,
  sessionIndexCookieOptions,
} from "./cookies"
import { isSameOrigin } from "./origin"

export { isSameOrigin }

/**
 * The cookie-jar operations both `/api/auth/*` handlers share.
 *
 * It exists so the LRU, the eviction rule and the origin check live in one
 * place: a session is now written per shop, and two handlers each keeping their
 * own idea of "which shops are signed in" is the kind of drift that shows up as
 * a visitor mysteriously signed out of a storefront they never visited.
 */

type Jar = Awaited<ReturnType<typeof cookies>>

/**
 * The shop a request is about, from `?shop=`.
 *
 * A query parameter rather than the body because it is the one channel a
 * body-less `DELETE` and a body-less refresh `POST` both support — so there is
 * exactly one place the slug can come from, in both handlers.
 *
 * These handlers sit at `/api/auth/*`, outside every shop segment, so unlike
 * the rest of this app they cannot read the scope out of their own URL. Passing
 * it explicitly is the same rule `storefrontContext(slug)` follows on the
 * server: the scope is an argument, never ambient.
 */
export function shopParam(req: Request): string | null {
  const raw = new URL(req.url).searchParams.get("shop")
  return raw && raw.length > 0 && raw.length <= 200 ? raw : null
}

export function readIndex(jar: Jar): string[] {
  const raw = jar.get(SESSION_INDEX_COOKIE)?.value ?? ""
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function writeIndex(jar: Jar, slugs: string[]) {
  if (slugs.length === 0) jar.delete(SESSION_INDEX_COOKIE)
  else
    jar.set(SESSION_INDEX_COOKIE, slugs.join(","), sessionIndexCookieOptions())
}

/** Move a slug to the front. Never deletes — this is the refresh path's version. */
export function touchIndex(jar: Jar, slug: string) {
  writeIndex(jar, [slug, ...readIndex(jar).filter((s) => s !== slug)])
}

/**
 * Move a slug to the front and evict past the cap.
 *
 * Call this **only from an explicit sign-in**, never from a refresh. Eviction
 * deletes another shop's cookies, and a background token rotation must not be
 * able to sign a visitor out of a tab they left open on a different storefront.
 *
 * Returns the evicted slugs so the caller can log them — "why was I signed out
 * of shop X" is otherwise unanswerable from production.
 */
export function touchIndexAndEvict(jar: Jar, slug: string): string[] {
  const next = [slug, ...readIndex(jar).filter((s) => s !== slug)]
  const evicted = next.slice(MAX_SHOP_SESSIONS)
  for (const gone of evicted) deleteSession(jar, gone)
  writeIndex(jar, next.slice(0, MAX_SHOP_SESSIONS))
  return evicted
}

export function dropFromIndex(jar: Jar, slug: string) {
  writeIndex(
    jar,
    readIndex(jar).filter((s) => s !== slug),
  )
}

export function writeSession(
  jar: Jar,
  slug: string,
  d: {
    access_token: string
    access_token_expires_at?: string | null
    refresh_token: string
    refresh_token_expires_at?: string | null
  },
) {
  jar.set(refreshCookie(slug), d.refresh_token, refreshCookieOptions())
  jar.set(accessCookie(slug), d.access_token, accessCookieOptions())

  if (d.access_token_expires_at) {
    jar.set(
      accessExpiresCookie(slug),
      d.access_token_expires_at,
      expiryCookieOptions(),
    )
  } else {
    jar.delete(accessExpiresCookie(slug))
  }

  if (d.refresh_token_expires_at) {
    jar.set(
      refreshExpiresCookie(slug),
      d.refresh_token_expires_at,
      expiryCookieOptions(),
    )
  } else {
    jar.delete(refreshExpiresCookie(slug))
  }
}

export function deleteSession(jar: Jar, slug: string) {
  for (const name of sessionCookieNames(slug)) jar.delete(name)
}

/** Every per-shop session cookie in the jar, whatever shop it belongs to. */
export function deleteAllSessions(jar: Jar) {
  for (const c of jar.getAll()) {
    if (SESSION_COOKIE_RE.test(c.name)) jar.delete(c.name)
  }
  jar.delete(SESSION_INDEX_COOKIE)
}
