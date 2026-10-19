/**
 * Turning a `Host` header into a shop scope.
 *
 * One deployment serves every storefront, and until now the shop was always the
 * first path segment: `/acme/products/blue-mug` is Acme's mug. That stays true.
 * What this module adds is a second address for the same page —
 * `acme.<root-domain>/products/blue-mug` — and the rule for telling the two
 * apart before anything else in the request has run.
 *
 * **Everything here is pure and synchronous.** `proxy.ts` (which decides the
 * rewrite), the RSC tree (which needs the scope before it can query), and the
 * browser (which needs it to name a cookie and set `X-SHOP`) all have to reach
 * the same answer, and the only way three runtimes agree for free is if the
 * answer is a function of the host string alone. That is also what makes the
 * whole thing testable without a request object.
 *
 * **No database, no network, no cache.** A platform subdomain *is* a shop
 * handle: the label is constrained by the same
 * `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` the back-end enforces on
 * `UpdateShopInput.slug`, so `acme.<root>` yields `acme` by reading it, not by
 * looking it up. Whether a shop by that name exists is decided where it always
 * was — `fetchShopShell` in `app/[shopSlug]/layout.tsx`, which already renders
 * the closed-storefront screen for a handle that resolves to nothing. A
 * merchant's own custom domain is the case that will need a lookup, and it is
 * deliberately not here yet.
 */

import { RESERVED_SUBDOMAINS } from "./reserved-subdomains"

/**
 * The shop-handle rule, mirrored from `UpdateShopInput.slug` on the back-end.
 *
 * A hostname label and a shop handle are the same shape by design — that is
 * what lets a subdomain be read as a handle rather than looked up.
 */
const LABEL_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Reduce a `Host` header to a bare, comparable hostname — or reject it.
 *
 * Returns `null` for anything malformed rather than a best guess. This value
 * decides which tenant a request belongs to, so "close enough" is the one
 * outcome that must not exist: a host that cannot be read confidently falls
 * through to the apex, where the worst case is the marketplace directory
 * instead of somebody else's shop.
 *
 * - lowercased, because DNS is case-insensitive and `Host` is whatever the
 *   client typed;
 * - port removed, including from a bracketed IPv6 literal;
 * - one trailing dot removed — `acme.zaydak.com.` is the fully-qualified form
 *   of the same name and some clients send it;
 * - userinfo, paths, whitespace and control characters refused outright. A
 *   `Host` carrying any of those is not a hostname, and every one of them is a
 *   shape used to make two parsers disagree about where the host ends.
 */
export function normalizeHostname(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null

  let host = raw.trim().toLowerCase()
  if (!host) return null

  // A `Host` header is `host[:port]` and nothing else.
  if (/[\s/\\@?#]/.test(host)) return null
  // Control characters cannot appear in a hostname. Spelled out with
  // charCodeAt rather than a regex character class so the source carries
  // no literal control bytes of its own, and checked HERE rather than
  // left to the per-label test below, because the IPv6 branch returns
  // before that ever runs.
  for (const ch of host) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code === 127) return null
  }

  // IPv6 literals are bracketed: `[::1]` or `[::1]:3000`. Never a tenant, but
  // it is a legal `Host` and must not be mistaken for a malformed one.
  if (host.startsWith("[")) {
    const close = host.indexOf("]")
    if (close === -1) return null
    const rest = host.slice(close + 1)
    if (rest && !/^:\d{1,5}$/.test(rest)) return null
    return host.slice(0, close + 1)
  }

  const colon = host.indexOf(":")
  if (colon !== -1) {
    if (!/^\d{1,5}$/.test(host.slice(colon + 1))) return null
    host = host.slice(0, colon)
  }

  // One trailing dot only. `acme.zaydak.com..` is malformed, not emphatic.
  if (host.endsWith(".")) host = host.slice(0, -1)
  if (!host || host.startsWith(".") || host.endsWith(".")) return null
  if (host.includes("..")) return null
  if (host.length > 253) return null

  for (const label of host.split(".")) {
    if (label.length === 0 || label.length > 63) return null
    if (!/^[a-z0-9-]+$/.test(label)) return null
    if (label.startsWith("-") || label.endsWith("-")) return null
  }

  return host
}

/**
 * The apex the platform's own storefronts hang off, e.g. `zaydak.com`.
 *
 * `NEXT_PUBLIC_` because `currentShopSlug()` runs in the browser and has to
 * reach the same verdict the proxy did. It is a public hostname, not a secret.
 *
 * **Defaults to `localhost`,** which does two useful things at once. In
 * development `demo.localhost:3003` works with no env file at all — browsers
 * resolve every `*.localhost` label to the loopback address with no hosts
 * entry. And on a deployment that forgets to set it, no real host ends in
 * `.localhost`, so every incoming request falls through to the path-based
 * behaviour this app already had: the feature is absent rather than broken, and
 * `zaydak.vercel.app/acme` keeps working either way.
 *
 * **That last paragraph is true of resolution only.** For emitting absolute
 * URLs the same default is a silent misconfiguration — see
 * `CANONICAL_ROOT_DOMAIN` below, which is what the write path uses.
 */
export const ROOT_DOMAIN = normalizeHostname(
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost",
)

/**
 * The apex, but **only when an operator actually configured one**.
 *
 * `ROOT_DOMAIN` above defaults to `localhost` so that `demo.localhost:3003`
 * works in development with no env file. That default is safe for *reading* a
 * host — no real host ends in `.localhost`, so a production request simply
 * falls through to path mode — but it is actively wrong for *writing* a URL,
 * and that asymmetry is the whole reason this second export exists.
 *
 * Reading asks "is this host a shop's?" and answers no for every real host.
 * Writing asks "what is this shop's address?" and, with the same default, would
 * answer `http://acme.localhost` — for every canonical tag, every OpenGraph URL
 * and every entry in both sitemaps, on any deployment that had not set the
 * variable. The path-form fallback would be unreachable, and the failure is
 * invisible in development because `http://acme.localhost` is *correct* there.
 *
 * So absolute URLs resolve against this one, which is null until somebody says
 * otherwise — and null is what makes `shopUrlBase` degrade to the path form
 * this app emitted before shop hostnames existed.
 */
export const CANONICAL_ROOT_DOMAIN = normalizeHostname(
  process.env.NEXT_PUBLIC_ROOT_DOMAIN,
)

/** What a `Host` header turned out to be. */
export type HostScope =
  /**
   * The apex itself, or a host that is not under it at all — a preview
   * deployment, a `*.vercel.app` URL, a bare IP, an unreadable header.
   *
   * All of these behave identically, and that is the point: the app falls back
   * to reading the shop out of the path, which is exactly what it did before
   * any of this existed. Every URL that worked yesterday still works.
   */
  | { kind: "apex" }
  /**
   * A label under the apex that the platform keeps for itself (`www`, `admin`,
   * `store`). Never a shop. Served as the apex, because `www.<root>` arriving
   * here should show the marketplace rather than a 404 — the redirect to the
   * bare apex is the CDN's job, and this is what happens if it does not run.
   */
  | { kind: "reserved"; label: string }
  /** A shop handle, read straight off the host. */
  | { kind: "tenant"; slug: string }

/**
 * Classify a `Host` header against the configured apex.
 *
 * `rootDomain` is a parameter rather than a module read so tests can cover a
 * real apex without the build-time env, and so a later caller can pass a value
 * it resolved some other way — a custom-domain lookup, say.
 */
export function resolveHostScope(
  rawHost: string | null | undefined,
  rootDomain: string | null = ROOT_DOMAIN,
): HostScope {
  const host = normalizeHostname(rawHost)
  if (!host || !rootDomain) return { kind: "apex" }

  if (host === rootDomain) return { kind: "apex" }

  const suffix = `.${rootDomain}`
  if (!host.endsWith(suffix)) return { kind: "apex" }

  const label = host.slice(0, -suffix.length)

  // Exactly one label, shaped like a handle. `a.b.<root>` is not a shop: DNS
  // wildcards only one level, so it cannot have been provisioned, and reading
  // `a.b` as a handle would send an `X-SHOP` no shop can ever match.
  if (!LABEL_RE.test(label) || label.length > 63) return { kind: "apex" }

  if (RESERVED_SUBDOMAINS.has(label)) return { kind: "reserved", label }

  return { kind: "tenant", slug: label }
}

/** The port out of a raw `Host` header, or null. Keeps dev links clickable. */
export function hostPort(raw: string | null | undefined): string | null {
  if (!raw) return null
  const match = /:(\d{1,5})$/.exec(raw.trim())
  return match ? match[1]! : null
}

/**
 * The absolute origin a shop's pages should present as their own.
 *
 * `https` unless the apex is `localhost`, where there is no certificate and the
 * dev server speaks plain HTTP. The port is carried through from the request's
 * own host, so a link emitted in development stays clickable.
 *
 * Returns null when there is no apex configured, which is how the callers that
 * build canonical URLs know to fall back to the path form.
 */
export function shopOrigin(
  slug: string,
  rootDomain: string | null = ROOT_DOMAIN,
  port?: string | null,
): string | null {
  if (!rootDomain || !LABEL_RE.test(slug)) return null
  const local = rootDomain === "localhost" || rootDomain.endsWith(".localhost")
  return `${local ? "http" : "https"}://${slug}.${rootDomain}${port ? `:${port}` : ""}`
}
