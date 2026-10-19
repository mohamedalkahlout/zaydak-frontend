/**
 * "Is this hostname actually being served by this deployment?"
 *
 * One fixed string, no tenant, no database. It exists so the back-end can
 * answer a question a DNS lookup cannot: **DNS pointing at the host is not the
 * same as the host serving this domain.** A record that resolves to the edge of
 * a platform that has never heard of the hostname gets a 404 from that platform
 * — or, before a certificate is issued, a TLS error, which a shopper cannot
 * tell apart from the shop being gone.
 *
 * Fetching this over HTTPS proves three things in one request that no DNS query
 * can prove at all:
 *
 *   1. DNS resolves to us,
 *   2. the host has the domain attached to *this* project,
 *   3. a valid certificate exists, because otherwise the fetch fails.
 *
 * **It is not a secret and does not need to be.** The only thing a forged
 * response buys is marking a domain active that does not serve — and to forge
 * it you must control what `https://<that domain>/api/domain-probe` returns,
 * which means you control the domain already. The worst outcome is a merchant
 * breaking their own storefront.
 *
 * `/api/…` is excluded by `proxy.ts`'s matcher, so this is never rewritten and
 * answers identically on every host — which is exactly what a probe needs.
 */

/** Mirrored in `back-end/src/shop-domains/providers/manual-domain.provider.ts`. */
export const DOMAIN_PROBE_MARKER = "zaydak-storefront";

// No caching anywhere: a cached 404 from before the domain was attached would
// keep a correctly configured domain reading as broken for the life of the
// cache entry, which is the one failure this route exists to detect.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(DOMAIN_PROBE_MARKER, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
