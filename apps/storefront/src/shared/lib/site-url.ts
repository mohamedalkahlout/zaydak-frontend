import {
  CANONICAL_ROOT_DOMAIN,
  normalizeHostname,
  shopOrigin,
} from "./hostname"

/**
 * The storefront's own public origin.
 *
 * Needed by exactly the two files that have to emit **absolute** URLs —
 * `robots.ts` and `sitemap.ts`. Everything else in the app links relatively,
 * because one deployment serves every shop and a hard-coded host would be wrong
 * for all but one of them.
 *
 * The vendor dashboard already carries the mirror of this as
 * `NEXT_PUBLIC_STOREFRONT_URL`, which is what it builds "view in shop" links
 * from. Deployments should set the two to the same value.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003"
).replace(/\/+$/, "")

/**
 * The absolute base for one shop's public URLs.
 *
 * A shop now has two live addresses — `zaydak.com/acme/...` and
 * `acme.zaydak.com/...` — and every absolute URL the app emits has to name the
 * same one, or the page's own canonical tag contradicts the sitemap that
 * listed it. **This function is that single answer**, and it deliberately
 * prefers the shop's own host: a merchant's domain is the address they promote,
 * and pointing the canonical at the marketplace path would tell crawlers the
 * shop's own storefront is the duplicate.
 *
 * Pure — no request, no headers — so the sitemaps (which Next builds outside
 * any request) and the per-page metadata can both call it and cannot drift.
 *
 * Resolved against `CANONICAL_ROOT_DOMAIN` — null until an operator sets
 * `NEXT_PUBLIC_ROOT_DOMAIN` — and **not** against `ROOT_DOMAIN`, whose
 * `localhost` default exists for resolving incoming hosts in development. With
 * that default this would name `http://acme.localhost` as the canonical address
 * of every page on any deployment that had not configured an apex, and the
 * path-form fallback below would be unreachable. Passing the configured value
 * is what makes "no apex set" mean "no second address", so this degrades to the
 * exact string the app emitted before shop hostnames existed.
 *
 * **A shop now has a third address, and it is the only one that cannot be
 * derived.** Once a merchant promotes their own domain, `acme.<root>` 308s to
 * it — so a canonical tag, an OpenGraph URL or a sitemap entry naming the
 * subdomain points at a redirect, which for a crawler is the same as pointing
 * nowhere. It cannot be read off a slug; it is a row in the database. So it is
 * handed *in*, by the one caller that can look it up
 * (`canonicalShopBase`, `shop-hostname.ts`), and this function stays pure.
 *
 * `primaryHostname` is validated rather than trusted, because it comes back
 * over the network and goes straight into a URL the whole world is told is
 * canonical. Anything that is not a readable hostname is dropped and the
 * subdomain form stands — which is also what an omitted argument means, so
 * every existing call site emits exactly the string it emitted before.
 */
export function shopUrlBase(
  slug: string | null | undefined,
  primaryHostname?: string | null,
): string {
  if (!slug) return SITE_URL

  const primary = normalizeHostname(primaryHostname)
  // `https` unconditionally: a custom domain only ever becomes ACTIVE with a
  // certificate provisioned, and `proxy.ts` redirects to the same scheme.
  if (primary) return `https://${primary}`

  return shopOrigin(slug, CANONICAL_ROOT_DOMAIN) ?? `${SITE_URL}/${slug}`
}

/**
 * A link to the marketplace directory, correct at either address.
 *
 * `href="/"` used to say "the directory" because one origin served everything.
 * On a shop's own hostname `/` is that **shop's** home, so the same markup now
 * means the opposite of what it says — and on the closed-storefront screen,
 * whose whole purpose is to offer a way out, "Browse all shops" becomes a link
 * back to the shop that is closed. A loop, on the one screen that must not have
 * one.
 *
 * So a shop host gets an absolute URL to the apex and the apex keeps the plain
 * relative `/`, which leaves every existing page byte-identical and keeps the
 * link same-origin where it always was.
 */
export function marketplaceHref(mode: "path" | "host"): string {
  return mode === "host" ? `${SITE_URL}/` : "/"
}
