/** A shop reduced to what the redirect check compares. */
export interface ShopIdentity {
  id: string
  slug: string
}

/**
 * Swap the shop segment, keep the rest of the path.
 *
 * `/store/old/products/mug` becomes `/store/new/products/mug`, so a dashboard
 * tab left open across a rename lands on the screen it was actually on rather
 * than being dumped on the shop home. The prefix has to end on a segment
 * boundary — `/store/older-shop` is not `/store/old` plus a tail — and
 * anything that does not match falls back to the shop's dashboard home.
 */
export function canonicalStorePath(
  pathname: string | null | undefined,
  from: string,
  to: string,
): string {
  const prefix = `/store/${from}`
  const home = `/store/${to}`
  if (!pathname) return home
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return home
  return `${home}${pathname.slice(prefix.length)}`
}

/**
 * Swap the shop segment under `/plan/...`, keep the rest of the path.
 *
 * `/plan/old/billing` becomes `/plan/new/billing`, falling back to `/plan/new`.
 */
export function canonicalPlanPath(
  pathname: string | null | undefined,
  from: string,
  to: string,
): string {
  const prefix = `/plan/${from}`
  const home = `/plan/${to}`
  if (!pathname) return home
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return home
  return `${home}${pathname.slice(prefix.length)}`
}

/**
 * The handle this URL should be using, or null to leave it alone.
 *
 * The whole point of the back-end's slug history is that a retired handle keeps
 * working, so a redirect here is a tidy-up, never a rescue: every uncertain
 * case returns null and the existing guards answer the request as they do
 * today.
 *
 * The last check is the loop guard and the reason this is a function rather
 * than two comparisons inline. `redirect()` sends the browser back through
 * this same layout, so a canonical slug that is not itself one of the vendor's
 * current slugs — two renames racing across tabs, a shop that has since moved
 * to another owner — would bounce forever.
 */
export function resolveCanonicalSlug({
  shopSlug,
  myShops,
  resolved,
}: {
  shopSlug: string
  myShops: ShopIdentity[]
  resolved: ShopIdentity | null | undefined
}): string | null {
  const currentSlugs = new Set(myShops.map((shop) => shop.slug))

  // The URL already names a shop the vendor holds: nothing to canonicalise,
  // and no reason to have asked the server in the first place.
  if (currentSlugs.has(shopSlug)) return null

  // Nothing resolved it — an unknown handle, or a read that failed. The
  // back-end's guards own that answer, not a redirect.
  if (!resolved) return null

  // Resolved to a shop that is not the vendor's. `ShopHeaderGuard` will refuse
  // it; moving the URL would only hide which address was wrong.
  if (!myShops.some((shop) => shop.id === resolved.id)) return null

  if (resolved.slug === shopSlug) return null
  if (!currentSlugs.has(resolved.slug)) return null

  return resolved.slug
}
