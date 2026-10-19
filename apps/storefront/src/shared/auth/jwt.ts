/**
 * Minimal JWT payload reader.
 *
 * Dependency-free and Edge-safe (`atob`, no `Buffer`) so `proxy.ts` can call it.
 *
 * **This does not verify the signature.** It cannot — the signing secret lives
 * on the back-end. A forged token with `role: "admin"` will pass every check
 * here. That is acceptable because nothing in this app is a security boundary:
 * the back-end authorizes every operation, and a forged token buys an empty
 * console whose queries all fail. Reading the role is a UX guard, so a signed-in
 * vendor lands on the login screen instead of an admin dashboard they cannot
 * use.
 */

interface JwtPayload {
  sub?: string
  role?: string
  permissions?: string[]
  exp?: number
}

/** Base64url → UTF-8 JSON. Returns null on anything malformed. */
function decodeSegment(segment: string): JwtPayload | null {
  try {
    const padding = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4))
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/") + padding

    // `atob` yields a binary string; walk the bytes back through
    // `decodeURIComponent` so multi-byte UTF-8 claims survive.
    const binary = atob(base64)
    const json = decodeURIComponent(
      Array.from(binary, (char) =>
        `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    )

    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== "object" || parsed === null) return null
    return parsed as JwtPayload
  } catch {
    return null
  }
}

export function decodeJwtPayload(token: string | undefined | null): JwtPayload | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  return decodeSegment(parts[1])
}

/** The `role` claim the back-end signs into every access token, or null. */
export function readRoleFromToken(token: string | undefined | null): string | null {
  const payload = decodeJwtPayload(token)
  return typeof payload?.role === "string" ? payload.role : null
}
