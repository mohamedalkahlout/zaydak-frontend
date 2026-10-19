/**
 * Apollo's development wording for invariant 91, thrown by
 * `QueryManager.cancelPendingFetches` when `clearStore()` runs.
 */
const DEV_MESSAGE = /Store reset while query was in flight/i

/**
 * The same error in a production build.
 *
 * Apollo strips invariant texts and ships only the *number*, wrapped in a
 * lookup URL: `…go.apollo.dev/c/err#%7B…%22message%22%3A91%2C…%7D`. A matcher
 * on the English sentence alone therefore passes every test and every dev
 * session, and fails in the one place the bug is user-visible. The negative
 * lookahead keeps 91 from matching 910/911.
 */
const MINIFIED_MESSAGE = /go\.apollo\.dev\/c\/err#[^\s]*%22message%22%3A91(?!\d)/

function messageOf(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return ""
}

/**
 * Is this the cache clear cancelling a request, rather than a real failure?
 *
 * `ShopCacheBoundary` drops the cache when the active shop changes, and
 * anything still in the link chain is rejected with this. It is expected
 * housekeeping — the screens are about to remount and fetch again — so the
 * one thing it must never do is paint an error page. Every other error stays
 * an error.
 */
export function isStoreResetError(error: unknown): boolean {
  const message = messageOf(error)
  if (!message) return false
  return DEV_MESSAGE.test(message) || MINIFIED_MESSAGE.test(message)
}
