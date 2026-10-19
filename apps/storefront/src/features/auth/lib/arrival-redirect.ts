/**
 * Where an in-app arrival at `/login` or `/register` should return.
 *
 * A client-side navigation carries the page the shopper just left as the
 * referrer. A cold load, another site, or a referrer that is the sign-in
 * page itself has nothing to go back to.
 */
export function arrivalRedirect(
  referrer: string,
  origin: string,
  currentPath: string,
): string | null {
  if (!referrer) return null
  let ref: URL
  try {
    ref = new URL(referrer)
  } catch {
    return null
  }
  if (ref.origin !== origin) return null
  const path = `${ref.pathname}${ref.search}`
  if (!path || path === currentPath) return null
  return path
}
