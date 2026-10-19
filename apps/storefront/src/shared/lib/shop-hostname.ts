import "server-only"

import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"
import { CANONICAL_ROOT_DOMAIN, normalizeHostname } from "./hostname"
import { SITE_URL, shopUrlBase } from "./site-url"

/**
 * The hostname a shop's public URLs should be **written** with.
 *
 * `shopUrlBase` answers this from the host string alone — `acme.<root>` — and
 * that answer stopped being right the moment a merchant could promote their own
 * domain. `acme.zaydak.com` still resolves, but it now 308s to `acme.com`, so
 * every canonical tag, every OpenGraph URL and every entry in both sitemaps was
 * naming an address that exists only to bounce. Self-consistent, and wasteful in
 * the one place where waste is expensive: a crawler follows the redirect on
 * every URL in the sitemap, and a canonical pointing at a redirect is a
 * canonical pointing at nothing — the same reason these are already built from a
 * shop's *current* handle rather than the one in the request.
 *
 * **The read path stays pure; only the write path looks anything up.** This is
 * the mirror of `domain-request.ts`, which exists because "is this the address
 * the shop uses?" is a fact about the database rather than about the string.
 * Same question, asked from the other end: there it is "the visitor arrived
 * here, where should they be?", here it is "we are about to print this shop's
 * address, which one is it?". Both go to `domainRequest`, which is the
 * back-end's single implementation of primacy — adding a second reader of
 * `is_primary` is how two URLs for one product start disagreeing.
 *
 * **Nothing here is on the request-serving path.** A failure, a timeout, an
 * unconfigured apex: all of them return null, and null means "use the address
 * `shopUrlBase` already built", which is exactly the string this app emitted
 * before custom domains existed. A metadata lookup must never be the reason a
 * page 500s.
 */

/**
 * How long a shop's primary hostname is held in this instance's memory.
 *
 * **Longer than `domain-request.ts` keeps a verdict, and — unlike that module —
 * a redirect target IS cached here.** That looks like a contradiction of the
 * invariant next door and is the opposite of one, because the two modules put
 * the answer to different uses. There, a stale redirect is a `Location` header:
 * two instances disagreeing about which domain is primary can point two
 * hostnames at each other, and the browser shows the visitor nothing at all. A
 * loop is the one failure worth paying a fresh read for on every request.
 *
 * Here the answer is printed into a `<link rel="canonical">` and a sitemap. A
 * stale one names the address the shop used a few minutes ago — which redirects
 * to the new one, which is precisely the behaviour this whole file exists to
 * improve on, and is what every page emitted before it. Nothing can loop,
 * nothing 500s, and a crawler re-reads the tag on its next visit. So the trade
 * runs the other way: cache it, and cache it long enough that rendering a
 * product page does not cost a round trip.
 *
 * The bound is the same shape as `SERVE_TTL_MS`'s — a per-instance TTL cannot be
 * invalidated, so after a merchant promotes a domain this instance keeps writing
 * the old canonical for at most this long.
 */
export const PRIMARY_HOSTNAME_TTL_MS = 5 * 60 * 1000

/** A shop with no custom domain is the common case; remember that too. */
export const PRIMARY_HOSTNAME_MISS_TTL_MS = 60 * 1000

/**
 * Bounded for the same reason `domain-request.ts` bounds its map, with one
 * difference that makes it less urgent and worth stating anyway: the keys here
 * are shop handles that resolved through `shop(slug)`, not arbitrary `Host`
 * headers. A marketplace with more live shops than this simply recycles the
 * coldest entries.
 */
export const MAX_PRIMARY_ENTRIES = 1000

interface Entry {
  hostname: string | null
  expires: number
}

const cache = new Map<string, Entry>()

const QUERY = `query ShopPrimaryHostname($hostname: String!) {
  domainRequest(hostname: $hostname) {
    data { slug action primary_hostname }
  }
}`

interface RawVerdict {
  slug?: string
  action?: string
  primary_hostname?: string | null
}

function remember(slug: string, hostname: string | null): string | null {
  cache.delete(slug)
  while (cache.size >= MAX_PRIMARY_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  cache.set(slug, {
    hostname,
    expires:
      Date.now() +
      (hostname ? PRIMARY_HOSTNAME_TTL_MS : PRIMARY_HOSTNAME_MISS_TTL_MS),
  })
  return hostname
}

/**
 * Read a primary hostname out of a verdict, or decide there is not one.
 *
 * The verdict is asked about the shop's **platform subdomain**, so the answer
 * reads as: `SERVE` means that subdomain is still the shop's address and there
 * is nothing to prefer over it; `REDIRECT` means a custom domain has been
 * promoted and `primary_hostname` is it.
 *
 * Three things are checked rather than trusted, because the result goes
 * straight into a URL the whole world is told is canonical. The slug has to be
 * the shop we asked about — an answer about somebody else's shop would move
 * every one of this shop's URLs onto their domain. The hostname has to survive
 * `normalizeHostname`, since a `Host`-shaped string is not necessarily a
 * hostname. And it has to differ from the subdomain we asked about, or the
 * "custom domain" is the platform address with extra steps.
 */
function readPrimary(
  raw: RawVerdict | null | undefined,
  slug: string,
  askedAbout: string,
): string | null {
  if (!raw || raw.slug !== slug) return null
  if (raw.action !== "REDIRECT") return null

  const hostname = normalizeHostname(raw.primary_hostname)
  if (!hostname || hostname === askedAbout) return null
  return hostname
}

/**
 * The custom domain a shop has promoted, or null when it has not promoted one.
 *
 * Null is the answer for every shop on a plain platform subdomain, for every
 * deployment with no apex configured, and for every failure — and in all three
 * cases the caller keeps the URL it would have built anyway. That is what makes
 * this safe to put in front of `generateMetadata`: the worst outcome is the
 * output this app produced yesterday.
 */
export async function shopPrimaryHostname(
  slug: string | null | undefined,
): Promise<string | null> {
  // No apex configured means no platform subdomain to ask about and no second
  // address to prefer — `shopUrlBase` is already emitting the `${SITE_URL}/slug`
  // path form, and there is nothing a lookup could add. Returning before the
  // network keeps an unconfigured deployment's output byte-identical and costs
  // it no requests at all.
  if (!slug || !CANONICAL_ROOT_DOMAIN) return null

  const askedAbout = `${slug}.${CANONICAL_ROOT_DOMAIN}`

  const hit = cache.get(slug)
  if (hit && hit.expires > Date.now()) return hit.hostname

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { hostname: askedAbout },
      }),
      // The map above is the cache that matters; Next's fetch cache would key
      // this per render pass and is not available in every caller anyway.
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })

    if (!response.ok) return remember(slug, null)

    const json = (await response.json()) as {
      data?: { domainRequest?: { data?: RawVerdict | null } }
    }
    return remember(
      slug,
      readPrimary(json.data?.domainRequest?.data, slug, askedAbout),
    )
  } catch {
    // Timeout, DNS failure, the API being down. A share card is never worth
    // taking a page down for.
    return remember(slug, null)
  }
}

/**
 * The absolute base a shop's public URLs are built on — **resolved**.
 *
 * The async counterpart to `shopUrlBase`, and the one every emitted URL should
 * go through: a canonical tag, an OpenGraph URL, a JSON-LD `Offer.url` and both
 * sitemaps all have to name one address for a page, and that address is the
 * shop's promoted domain the moment it has one.
 *
 * Degrades in one step at a time. No custom domain, or no answer: the platform
 * subdomain, exactly as before. No apex configured: `${SITE_URL}/${slug}`,
 * exactly as before that.
 */
export async function canonicalShopBase(
  slug: string | null | undefined,
): Promise<string> {
  if (!slug) return SITE_URL
  return shopUrlBase(slug, await shopPrimaryHostname(slug))
}

/** Drop a cached hostname. Exported for tests; nothing in the app calls it. */
export function forgetShopPrimaryHostname(slug?: string): void {
  if (slug) cache.delete(slug)
  else cache.clear()
}

/** How many shops are currently remembered. Exported for tests. */
export function primaryHostnameCacheSize(): number {
  return cache.size
}
