/**
 * Where to send a customer after they sign in.
 *
 * The `?redirect=` parameter is attacker-controllable — it is written by the
 * route guard but nothing stops someone handing out a link with their own
 * value. Only same-origin *paths* are honoured.
 *
 * The subtle case is `//evil.example`: that is a protocol-relative URL, the
 * browser treats it as absolute, and it starts with `/` — so a naive
 * `startsWith("/")` check lets an open redirect straight through. `\\` is the
 * same trick, because several browsers normalise a backslash to a slash in the
 * authority position.
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback
  if (!raw.startsWith("/")) return fallback
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  return raw
}
