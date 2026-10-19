import "server-only";

import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { normalizeHostname, ROOT_DOMAIN } from "./hostname"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

/**
 * What to do with a request that arrived on a given hostname.
 *
 * **This is the one question tenant resolution cannot answer by reading.** A
 * platform subdomain carries its own tenant — `acme.<root>` is the `acme` shop
 * by reading it, and `resolveTenant` still does exactly that, purely and
 * synchronously, because the proxy, the RSC tree and the browser all have to
 * reach the same verdict. But "is this the address the shop actually uses?"
 * is a fact about the database, not about the string: the merchant may have
 * connected `acme.com` and promoted it since, and nothing in the hostname says
 * so.
 *
 * Keeping the two separate is what preserves the pure path. The tenant is still
 * read; only the **redirect decision** is looked up, and only the proxy needs
 * it — nothing in the server tree ever asks.
 *
 * **The verdict itself is not computed here.** The back-end owns it
 * (`ShopDomainsService.resolveDomainRequest`) so there is exactly one
 * implementation of "serve or redirect, and where to", rather than one here and
 * another wherever primacy is read next. This module is a cache in front of it.
 */

/**
 * How long a `SERVE` verdict is held in this instance's memory.
 *
 * **This is a staleness bound, not an invalidation, and the difference is the
 * whole reason it is written down.** The back-end holds the shared copy in
 * Redis and *does* invalidate it — every write that could change a verdict
 * clears the keys for every hostname the shop answers at — so the answer on the
 * other side of this fetch is correct within milliseconds of a merchant
 * changing something. This map is one hop in front of that, it lives in a
 * single serverless instance's memory, and **nothing can reach it**: there is
 * no key for the back-end to delete, no broadcast, and no list of which
 * instances are warm. Each one warms and forgets its own copy independently.
 *
 * So the bound is arithmetic rather than a promise. After a merchant detaches a
 * domain, promotes a different one, or closes the shop, a given instance keeps
 * serving the old answer for **at most `SERVE_TTL_MS`** — sixty seconds — and
 * instances expire at different moments, so for up to a minute two requests to
 * the same hostname can legitimately disagree. That is the ceiling on every "I
 * removed it and it is still there" report, and it is acceptable for exactly
 * one reason: a stale `SERVE` shows the merchant their own shop at an address
 * they have just stopped using. It cannot show somebody else's shop — the
 * verdict carries the slug that owned the hostname — and it cannot loop,
 * because a `REDIRECT` is never cached at all (see `ttlFor`).
 *
 * Sixty seconds is the largest number that keeps that ceiling inside the window
 * a merchant is still looking at the screen after changing something.
 * Shortening it narrows the window without closing it; only a cache shared
 * between instances closes it, and that is infrastructure this app does not own.
 *
 * Exported because a bound nobody can read is not a bound: the tests that pin
 * it, and anyone reasoning about how long a change takes to land, need the
 * number itself rather than a sentence about it.
 */
export const SERVE_TTL_MS = 60 * 1000

/**
 * A miss — and a failure — lasts a shorter time still.
 *
 * Long enough to absorb a bot sweeping hostnames, short enough that a merchant
 * who has just finished DNS setup is not told their domain does not exist for
 * a minute afterwards — which, to them, reads as the verification having
 * failed.
 *
 * **An API failure is deliberately cached on this same clock rather than not at
 * all.** Not caching it would put the 2.5-second timeout below in front of
 * every request to every custom domain for as long as the back-end is down,
 * which turns a degraded storefront into an unusable one; caching it longer
 * would keep a shop off its own domain after the API came back. It is bounded
 * in the harmless direction either way — a missing verdict means "serve
 * whatever the host string resolved to", which is what this app did before
 * redirects existed.
 */
export const MISS_TTL_MS = 30 * 1000

/**
 * The most hostnames this instance will remember at once.
 *
 * The keys here are attacker-chosen: anything at all can arrive in a `Host`
 * header, and `worthResolving` lets through every string with a dot in it
 * because that is exactly the shape a real custom domain has. Without a ceiling
 * one sweep of generated hostnames grows this map for the life of the process —
 * an unbounded leak, in the one module that runs ahead of every request.
 *
 * Five hundred is far above the real working set (a deployment's live custom
 * domains plus the platform subdomains being browsed) and small enough that a
 * full map is a rounding error in memory.
 */
export const MAX_ENTRIES = 500

export interface DomainVerdict {
  /** The shop's handle — what goes out as `X-SHOP`. */
  slug: string
  role: "PLATFORM" | "PRIMARY" | "ALIAS"
  action: "SERVE" | "REDIRECT"
  /** Where to send the visitor. Present only when `action` is `REDIRECT`. */
  primaryHostname?: string
}

interface Entry {
  verdict: DomainVerdict | null
  expires: number
}

const cache = new Map<string, Entry>()

/**
 * **A redirect verdict is never cached, and that is what makes a loop
 * impossible rather than merely unlikely.**
 *
 * At most one domain is primary at a time — `setPrimary` clears the others in
 * the same transaction — so a *consistent* read can never produce two hostnames
 * pointing at each other. Every loop has to come from two stale answers
 * disagreeing: this instance cached `a.com -> b.com` while b was primary, the
 * merchant then promoted a.com, and another instance cached `b.com -> a.com`.
 * Both are individually correct, both are live, and between them the browser
 * gets nothing at all.
 *
 * Shortening the window would have made that rarer without making it
 * impossible, and "rare" is the wrong property for a failure that shows the
 * visitor a blank page. Not caching the answer removes the disagreement:
 * every redirect is decided from one fresh, consistent read.
 *
 * The cost is bounded and falls in the right place. A redirecting hostname is
 * by definition the address the shop has *stopped* using, so it carries the
 * least traffic, and the response is a header — no page is rendered. It also
 * removes the other stale-redirect hazard for free: a primary the nightly sweep
 * has just demoted stops being a target immediately rather than after a TTL.
 */
function ttlFor(verdict: DomainVerdict | null): number | null {
  if (!verdict) return MISS_TTL_MS
  return verdict.action === "REDIRECT" ? null : SERVE_TTL_MS
}

function remember(host: string, verdict: DomainVerdict | null) {
  const ttl = ttlFor(verdict)
  if (ttl === null) return verdict

  // Delete first, so re-caching an existing hostname moves it to the end of the
  // insertion order. Without it `Map.set` leaves the key where it was, the
  // eviction below drops the hottest entry rather than the coldest, and a
  // refresh of a key already held evicts a stranger to make room for a seat it
  // is already sitting in.
  cache.delete(host)

  // Cheapest possible eviction: when full, drop the oldest insertion. A proper
  // LRU would need a touch on every read, and the access pattern here is a
  // small set of real domains plus a long tail of one-off probes — exactly the
  // shape where insertion order and recency agree.
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }

  cache.set(host, { verdict, expires: Date.now() + ttl })
  return verdict
}

/**
 * Whether a host could belong to a shop at all.
 *
 * The apex is the marketplace and never redirects; `localhost` and bare IPs are
 * development and health checks. A platform subdomain is **not** excluded here,
 * unlike the lookup this replaced: it has a tenant already, but whether that
 * tenant still uses this address is exactly what has to be asked.
 */
export function worthResolving(host: string): boolean {
  if (ROOT_DOMAIN && host === ROOT_DOMAIN) return false
  if (host === "localhost" || host.endsWith(".localhost")) return false
  if (host.startsWith("[")) return false
  // A bare IPv4 address. Nobody points a certificate at one.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  return host.includes(".")
}

const QUERY = `query DomainRequest($hostname: String!) {
  domainRequest(hostname: $hostname) {
    data { slug role action primary_hostname }
  }
}`

interface RawVerdict {
  slug?: string
  role?: string
  action?: string
  primary_hostname?: string | null
}

/**
 * Reject anything that is not a verdict this proxy can act on.
 *
 * The response crosses a network boundary into code that will issue a redirect
 * from it, so the shape is checked rather than trusted. The rule that matters
 * is the last one: a `REDIRECT` with no destination, or one pointing at the
 * host we are already on, is dropped to a `SERVE` — because the failure mode of
 * getting that wrong is not a bad page, it is an infinite redirect loop, and a
 * browser shows the visitor nothing at all.
 */
function parse(raw: RawVerdict | null | undefined, host: string): DomainVerdict | null {
  if (!raw || typeof raw.slug !== "string" || !raw.slug) return null

  const role =
    raw.role === "PLATFORM" || raw.role === "PRIMARY" || raw.role === "ALIAS"
      ? raw.role
      : "PRIMARY"

  const target = raw.primary_hostname?.trim().toLowerCase() ?? ""
  const redirecting =
    raw.action === "REDIRECT" && target.length > 0 && target !== host

  return {
    slug: raw.slug,
    role,
    action: redirecting ? "REDIRECT" : "SERVE",
    primaryHostname: redirecting ? target : undefined,
  }
}

/**
 * The verdict for a hostname, or null when no shop answers there.
 *
 * **Never throws.** This runs inside the proxy, ahead of every page: an API
 * blip must degrade to "serve whatever the host string resolved to" — which is
 * the behaviour the storefront had before redirects existed — rather than
 * taking down every request. A failure is cached as a miss for the short TTL so
 * a flapping API is not hammered.
 */
export async function resolveDomainRequest(
  rawHost: string | null | undefined,
): Promise<DomainVerdict | null> {
  const host = normalizeHostname(rawHost)
  if (!host || !worthResolving(host)) return null

  const hit = cache.get(host)
  if (hit && hit.expires > Date.now()) return hit.verdict

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
      },
      body: JSON.stringify({ query: QUERY, variables: { hostname: host } }),
      // Next's own fetch cache is deliberately bypassed: this runs in the proxy
      // where that cache does not apply, and the map above is the layer that
      // matters.
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })

    if (!response.ok) return remember(host, null)

    const json = (await response.json()) as {
      data?: { domainRequest?: { data?: RawVerdict | null } }
    }
    return remember(host, parse(json.data?.domainRequest?.data, host))
  } catch {
    // Timeout, DNS failure, the API being down. All the same answer here.
    return remember(host, null)
  }
}

/** Drop a cached answer. Exported for tests; nothing in the app calls it. */
export function forgetDomainRequest(host?: string): void {
  if (host) cache.delete(host)
  else cache.clear()
}

/**
 * How many hostnames are currently remembered.
 *
 * Exported for tests, like `forgetDomainRequest` beside it, and for the same
 * reason: the two properties worth pinning about this map — that a redirect
 * never takes a seat in it, and that it never grows past `MAX_ENTRIES` — are
 * both statements about its size, and neither is observable from the verdicts
 * it hands back.
 */
export function domainCacheSize(): number {
  return cache.size
}
