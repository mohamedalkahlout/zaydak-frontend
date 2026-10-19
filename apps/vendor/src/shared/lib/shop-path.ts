/**
 * Routes shaped `/<prefix>/{shopSlug}/...` — the dashboard paths that name a
 * shop.
 *
 * `/plan` is not under `/store` — it deliberately escapes the dashboard
 * layout — but it is just as shop-scoped, and server-side Apollo reads the
 * shop only from the `active_shop_slug` cookie the proxy writes from these
 * paths. Without it, a vendor returning from Stripe straight to `/plan/{slug}`
 * would be answered for whichever store they happened to open last.
 */
export const SHOP_SCOPED_PREFIXES = ["/store", "/plan"]

/**
 * Segments that sit where a shop slug sits but are screens, not shops.
 *
 * Without this, `/store/change-password` wrote `active_shop_slug=change-password`
 * on the way through — and server-side Apollo reads that cookie for its
 * `X-SHOP` header, so every server query after a password change went out
 * scoped to a shop that does not exist.
 */
export const STATIC_SHOP_SEGMENTS = new Set(["change-password"])

/**
 * The shop handle a dashboard path names, or null when it names none: a path
 * outside `SHOP_SCOPED_PREFIXES`, a bare `/store`, or a static screen such as
 * `/store/change-password`.
 *
 * One answer for the proxy, which writes the handle into `active_shop_slug`,
 * and for sign-in, which has to decide whether a `?redirect=` names a shop the
 * account holds — two copies of "which segment is a shop" would drift the
 * first time a static screen is added. Accepts a query string or fragment,
 * because a redirect target arrives with one: `/store/acme?tab=orders` names
 * `acme`.
 */
export function shopSlugOfPath(path: string): string | null {
  for (const prefix of SHOP_SCOPED_PREFIXES) {
    if (!path.startsWith(`${prefix}/`)) continue
    const slug = path.slice(prefix.length + 1).split(/[/?#]/, 1)[0]
    return slug && !STATIC_SHOP_SEGMENTS.has(slug) ? slug : null
  }
  return null
}
