/**
 * Whether this request came from our own pages.
 *
 * `POST /api/auth/session` writes credentials straight from its body, so
 * without this a cross-site `text/plain` form post can put attacker-supplied
 * tokens in a victim's jar — session fixation.
 *
 * `Sec-Fetch-Site` is the reliable signal and every browser that can make the
 * attack sends it. `Origin` is the fallback; a request with neither is not a
 * browser form post.
 */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site")
  if (site) return site === "same-origin"

  const origin = req.headers.get("origin")
  if (!origin) return true

  try {
    return new URL(origin).host === new URL(req.url).host
  } catch {
    return false
  }
}
