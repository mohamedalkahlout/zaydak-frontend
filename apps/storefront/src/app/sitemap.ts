import type { MetadataRoute } from "next"

import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"
import { SITE_URL } from "@/shared/lib/site-url"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

/**
 * Every public URL in the marketplace: the directory, then each open shop's
 * home and catalogue, then each of its products.
 *
 * **Why it is a plain `fetch` and not the RSC Apollo client.** This file is not
 * rendered as part of a page — Next builds it on its own — so the per-request
 * client `registerApolloClient` hands out has no request to be scoped to. Two
 * hand-written documents asking for nothing but slugs are cheaper than
 * borrowing the page queries, which select images, prices and stock this file
 * has no use for.
 *
 * **The scope header still has to be right.** `storefrontProducts` is behind
 * `RequireShopGuard`, so the product sweep is one request per shop carrying
 * that shop's `X-SHOP`. There is no ambient "current shop" to lean on here and
 * deliberately none available — see `shared/lib/shop-scope.ts`.
 *
 * **Nothing here fails a build or a request.** Every read is wrapped: a shop
 * whose products cannot be listed contributes its home and catalogue and
 * nothing else, and a total failure still emits the directory. An hour of
 * `revalidate` means the first crawl after the API comes back rebuilds it.
 */

export const revalidate = 3600

/**
 * Bounds, and they are real: a sitemap is capped at 50,000 URLs by the protocol
 * and this is one file rather than a `generateSitemaps` split. Both limits are
 * reported when they bite — a sitemap that silently stopped listing a vendor's
 * catalogue at product 1,000 would read as "these are all the products", which
 * is the one thing it must never say by accident.
 */
const MAX_SHOPS = 500
const MAX_PRODUCTS_PER_SHOP = 1000
const PAGE_SIZE = 100
/** How many shops' catalogues are swept at once. */
const CONCURRENCY = 6

const SHOPS_QUERY = /* GraphQL */ `
  query SitemapShops($page: Int!, $limit: Int!) {
    shops(page: $page, limit: $limit, is_approved: true) {
      data {
        slug
      }
      meta {
        total_pages
      }
    }
  }
`

const PRODUCTS_QUERY = /* GraphQL */ `
  query SitemapProducts($filters: ProductFilterInput) {
    storefrontProducts(filters: $filters) {
      data {
        slug
      }
      meta {
        total_pages
      }
    }
  }
`

interface Page<T> {
  data: T[]
  meta: { total_pages: number }
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  shopSlug?: string,
): Promise<T | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
        ...(shopSlug ? { "X-SHOP": shopSlug } : {}),
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: T | null }
    return json.data ?? null
  } catch {
    return null
  }
}

/**
 * Walk a paged list until it runs out, hits `max`, or a read fails.
 *
 * The three outcomes are reported apart because they mean different things to
 * whoever reads the log: `"capped"` is this file's own limit and asks for
 * `generateSitemaps()`, `"failed"` is the API and asks for nothing, and
 * `"complete"` is silence.
 */
async function collectSlugs(
  read: (page: number) => Promise<Page<{ slug: string }> | null>,
  max: number,
): Promise<{ slugs: string[]; outcome: "complete" | "capped" | "failed" }> {
  const slugs: string[] = []
  let page = 1
  let totalPages = 1
  let failed = false

  while (page <= totalPages && slugs.length < max) {
    const result = await read(page)
    if (!result) {
      failed = true
      break
    }
    slugs.push(...result.data.map((entry) => entry.slug))
    totalPages = result.meta.total_pages
    page += 1
  }

  return {
    slugs: slugs.slice(0, max),
    outcome: failed ? "failed" : slugs.length >= max ? "capped" : "complete",
  }
}

async function shopSlugs(): Promise<string[]> {
  const { slugs, outcome } = await collectSlugs(
    async (page) => {
      const data = await gql<{ shops: Page<{ slug: string }> }>(SHOPS_QUERY, {
        page,
        limit: PAGE_SIZE,
      })
      return data?.shops ?? null
    },
    MAX_SHOPS,
  )

  if (outcome === "capped") {
    console.warn(
      `[sitemap] Stopped at ${MAX_SHOPS} approved shops; any beyond that are not listed. Split the sitemap with generateSitemaps().`,
    )
  } else if (outcome === "failed") {
    console.warn(
      `[sitemap] Could not finish listing shops — ${slugs.length} listed, the rest omitted.`,
    )
  }
  return slugs
}

async function productSlugs(shopSlug: string): Promise<string[]> {
  const { slugs, outcome } = await collectSlugs(
    async (page) => {
      const data = await gql<{ storefrontProducts: Page<{ slug: string }> }>(
        PRODUCTS_QUERY,
        { filters: { page, limit: PAGE_SIZE, sort_by: "NEWEST" } },
        shopSlug,
      )
      return data?.storefrontProducts ?? null
    },
    MAX_PRODUCTS_PER_SHOP,
  )

  if (outcome === "capped") {
    console.warn(
      `[sitemap] Stopped at ${MAX_PRODUCTS_PER_SHOP} products for shop "${shopSlug}"; any beyond that are not listed.`,
    )
  } else if (outcome === "failed") {
    console.warn(
      `[sitemap] Could not finish listing products for shop "${shopSlug}" — ${slugs.length} listed, the rest omitted.`,
    )
  }
  return slugs
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
  ]

  const shops = await shopSlugs()

  for (let start = 0; start < shops.length; start += CONCURRENCY) {
    const batch = shops.slice(start, start + CONCURRENCY)
    // The shop's address is resolved beside its catalogue rather than derived
    // from the slug, because a shop that has promoted its own domain no longer
    // lives at `<slug>.<root>` — that address 308s. Listed at the subdomain,
    // every URL in this file is one a crawler has to follow twice before it
    // reaches a page. It is one extra read per shop, on the same bounded
    // fan-out as the product sweep, memoised per slug in `shop-hostname.ts`,
    // and it degrades to the old string on any failure.
    const catalogues = await Promise.all(
      batch.map(async (shop) => ({
        shop,
        base: await canonicalShopBase(shop),
        products: await productSlugs(shop),
      })),
    )

    for (const { base, products } of catalogues) {
      entries.push(
        { url: base, changeFrequency: "daily", priority: 0.8 },
        {
          url: `${base}/products`,
          changeFrequency: "daily",
          priority: 0.7,
        },
        ...products.map((product) => ({
          url: `${base}/products/${product}`,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        })),
      )
    }
  }

  // No `lastModified`. `PublicProduct` exposes `created_at` and no update
  // timestamp, and publishing a creation date as a modification date would tell
  // crawlers that every edited product is untouched since the day it was added
  // — worse than saying nothing, because they act on it.
  return entries
}
