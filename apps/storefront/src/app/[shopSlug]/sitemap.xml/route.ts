import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { fetchShopShell } from "@/features/shop/lib/shop-server"
import { canonicalShopBase } from "@/shared/lib/shop-hostname"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

export const revalidate = 3600

const MAX_PRODUCTS = 2000
const PAGE_SIZE = 100

const PRODUCTS_QUERY = /* GraphQL */ `
  query ShopSitemapProducts($filters: ProductFilterInput) {
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

async function fetchProducts(shopSlug: string): Promise<string[]> {
  const slugs: string[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && slugs.length < MAX_PRODUCTS) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SHOP": shopSlug,
          ...tunnelHeaders(GRAPHQL_URL),
        },
        body: JSON.stringify({
          query: PRODUCTS_QUERY,
          variables: { filters: { page, limit: PAGE_SIZE, sort_by: "NEWEST" } },
        }),
        next: { revalidate },
      })

      if (!res.ok) break
      const json = (await res.json()) as {
        data?: { storefrontProducts: Page<{ slug: string }> } | null
      }
      const paged = json.data?.storefrontProducts
      if (!paged?.data) break

      slugs.push(...paged.data.map((p) => p.slug))
      totalPages = paged.meta.total_pages
      page += 1
    } catch {
      break
    }
  }

  return slugs
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case "'":
        return "&apos;"
      case '"':
        return "&quot;"
      default:
        return c
    }
  })
}

interface SitemapUrl {
  loc: string
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority: number
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  const { shopSlug } = await params
  const shop = await fetchShopShell(shopSlug)

  if (!shop) {
    return new Response("Shop not found", { status: 404 })
  }

  // The shop's CURRENT canonical address — its promoted custom domain when it
  // has one, its platform subdomain when an apex is configured, the marketplace
  // path otherwise. Built from `shop.slug` rather than the requested `shopSlug`
  // so a sitemap fetched at a retired handle lists the live URLs instead of a
  // page of redirects; resolved through `canonicalShopBase` for the same reason
  // one step further on, since the subdomain 308s once a domain is promoted and
  // a sitemap of redirects is one a crawler has to follow twice.
  const base = await canonicalShopBase(shop.slug)

  const urls: SitemapUrl[] = [
    {
      loc: base,
      changefreq: "daily",
      priority: 1.0,
    },
    {
      loc: `${base}/products`,
      changefreq: "daily",
      priority: 0.8,
    },
    {
      loc: `${base}/contact`,
      changefreq: "monthly",
      priority: 0.5,
    },
  ]

  // Add policies if any policy exists in settings
  const policies = shop.settings?.policies
  if (policies) {
    if (policies.refund_policy?.trim()) {
      urls.push({
        loc: `${base}/policies/refund`,
        changefreq: "monthly",
        priority: 0.4,
      })
    }
    if (policies.privacy_policy?.trim()) {
      urls.push({
        loc: `${base}/policies/privacy`,
        changefreq: "monthly",
        priority: 0.4,
      })
    }
    if (policies.terms_of_service?.trim()) {
      urls.push({
        loc: `${base}/policies/terms`,
        changefreq: "monthly",
        priority: 0.4,
      })
    }
    if (policies.shipping_policy?.trim()) {
      urls.push({
        loc: `${base}/policies/shipping`,
        changefreq: "monthly",
        priority: 0.4,
      })
    }
  }

  // Add individual product pages
  const productSlugs = await fetchProducts(shopSlug)
  for (const slug of productSlugs) {
    urls.push({
      loc: `${base}/products/${slug}`,
      changefreq: "weekly",
      priority: 0.7,
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
