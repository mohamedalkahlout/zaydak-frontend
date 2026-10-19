import type { MetadataRoute } from "next"
import { headers } from "next/headers"

import {
  GUEST_ONLY_SEGMENTS,
  PRIVATE_SEGMENTS,
} from "@/shared/auth/route-access"
import { hostPort, resolveHostScope, shopOrigin } from "@/shared/lib/hostname"
import { SITE_URL } from "@/shared/lib/site-url"

/**
 * What a crawler may read.
 *
 * The rules are **derived from the route guard**, not typed out again: every
 * segment in `PRIVATE_SEGMENTS` needs a session, so a crawler reaching one gets
 * a redirect to a sign-in page and nothing else, and every segment in
 * `GUEST_ONLY_SEGMENTS` is a form. Listing them here by hand would be a second
 * copy of the same list, and the copy that gets forgotten when a route is added
 * is always this one.
 *
 * `cart` and `wishlist` are the additions, and they are here for the same
 * reason. Both are public — each works signed-out, which is the whole point of
 * `session_id` and of the staged guest wishlist — but both are per-visitor
 * pages with no content of their own, and an indexed empty cart is a result
 * that helps nobody. `wishlist` used to arrive through `PRIVATE_SEGMENTS`; when
 * it stopped being gated it had to be named here, or opening the page to
 * shoppers would have quietly opened it to crawlers too.
 */
const NOT_WORTH_CRAWLING = [
  ...PRIVATE_SEGMENTS,
  ...GUEST_ONLY_SEGMENTS,
  "cart",
  "wishlist",
]

/**
 * The shape of the disallow patterns **depends on which host asked**, and
 * getting it wrong fails silently in the worst direction.
 *
 * On the apex every one of these paths sits under a shop slug, so the pattern
 * needs a wildcard segment in front: `/acme/checkout` and `/beta/checkout` are
 * different URLs and a new shop appears without a deploy. On a shop's own
 * hostname there is no slug segment at all — the path is simply `/checkout` —
 * and `/*​/checkout` matches nothing there. The file would still be served, with
 * rules in it, all of them inert: every private page of every shop host opened
 * to crawlers with no test failing and nothing in the output looking wrong.
 *
 * This route is **not rewritten by the proxy** — the matcher excludes anything
 * with a file extension, so `robots.txt` never reaches it — which is why the
 * host is read here directly rather than taken from a header the proxy sets.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")
  const scope = resolveHostScope(host)
  const onShopHost = scope.kind === "tenant"

  const prefixes = onShopHost ? [""] : ["/*"]

  // A shop host serves its OWN sitemap at `/sitemap.xml` — the proxy rewrites
  // that one path to `app/[shopSlug]/sitemap.xml/route.ts`. Pointing at the
  // apex's index from here would hand a crawler that started at
  // `acme.zaydak.com` a list of every other shop's URLs, on hosts this one has
  // no standing to speak for.
  const sitemapOrigin =
    (onShopHost ? shopOrigin(scope.slug, undefined, hostPort(host)) : null) ??
    SITE_URL

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        ...NOT_WORTH_CRAWLING.flatMap((segment) =>
          prefixes.flatMap((prefix) => [
            `${prefix}/${segment}`,
            `${prefix}/${segment}/`,
          ]),
        ),
      ],
    },
    sitemap: `${sitemapOrigin}/sitemap.xml`,
  }
}
