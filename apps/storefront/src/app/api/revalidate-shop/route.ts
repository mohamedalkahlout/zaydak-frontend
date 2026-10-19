import { revalidateTag } from "next/cache"
import { timingSafeEqual } from "node:crypto"

/**
 * "This shop's identity changed — forget what you cached about it."
 *
 * `fetchShopShell` tags its fetch `shop:<slug>` and revalidates on an hour,
 * which was sized for a fact that changes about never. It is still the right
 * TTL and it was the wrong *only* mechanism: a vendor who publishes a new brand
 * colour, logo or slogan watches their own storefront and sees the old one, for
 * up to sixty minutes, with nothing on screen to say the change landed. Nothing
 * called `revalidateTag` at all — the tag was written and never read.
 *
 * So the hour stays as the backstop and this is the push. `updateShop` pings it
 * on every write that can change what the shell renders.
 *
 * **Opt-in on both ends, and unset means today's behaviour.** With no
 * `REVALIDATE_SECRET` configured this route refuses everything, and the
 * back-end with no `STOREFRONT_REVALIDATE_SECRET` sends nothing — so a
 * deployment that has not been given the shared secret keeps exactly the
 * one-hour staleness it has now rather than gaining an unauthenticated endpoint.
 * Refusing is the only safe default: an open cache-purge URL is a free way to
 * make every request miss and hit the API, which is a denial-of-service with no
 * credentials and no rate limit in front of it.
 */

/** Mirrored in `back-end/src/shops/lib/storefront-revalidation.service.ts`. */
const SECRET_HEADER = "x-revalidate-secret"

/**
 * How many handles one call may purge.
 *
 * A rename sends two (the old handle and the new one) and nothing legitimately
 * sends more, so this is a bound on what a leaked secret is worth rather than a
 * capacity limit.
 */
const MAX_SLUGS = 8

/** The same shape a shop handle is constrained to everywhere else. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Constant-time, and length-safe.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false,
 * which would turn "the attacker sent a short string" into a 500 and leak the
 * secret's length through the status code. Comparing lengths first is not the
 * leak it looks like: the length of a secret is not the secret.
 */
function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.REVALIDATE_SECRET?.trim()
  if (!expected) {
    // Not "misconfigured" — this is the documented off state, and it is the
    // state every deployment starts in.
    return new Response("Revalidation is not enabled.", { status: 404 })
  }

  const given = request.headers.get(SECRET_HEADER)
  if (!given || !secretMatches(given, expected)) {
    return new Response("Unauthorized", { status: 401 })
  }

  let slugs: unknown
  try {
    slugs = ((await request.json()) as { slugs?: unknown })?.slugs
  } catch {
    return new Response("Expected a JSON body.", { status: 400 })
  }

  if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > MAX_SLUGS) {
    return new Response(`Expected 1 to ${MAX_SLUGS} slugs.`, { status: 400 })
  }

  const valid = slugs.filter(
    (slug): slug is string => typeof slug === "string" && SLUG.test(slug),
  )

  // **The second argument is required in Next 16 and is inert here.** It names
  // a cache-life profile, which governs `use cache` entries; `fetchShopShell`
  // is a plain `fetch` with `next: { revalidate, tags }`, so its tag is simply
  // added to the revalidated set and the profile never applies to it. `"max"`
  // is the value Next's own deprecation message names for exactly this call.
  //
  // `updateTag` would be the more direct "expire it now", and cannot be used:
  // it throws outside a Server Action, and this is a route handler.
  for (const slug of valid) revalidateTag(`shop:${slug}`, "max")

  // **The count of what was purged, never whether a shop exists.** A tag with
  // no cache entry revalidates silently, so this number says how many handles
  // were well-formed and nothing about which of them are real — the caller
  // already knows, and an endpoint behind a shared secret is still not a
  // directory anyone should be able to enumerate.
  return Response.json({ revalidated: valid.length })
}
