import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "../route"

const canonicalShopBaseMock = vi.hoisted(() => vi.fn())

/**
 * Only the address resolver is replaced; the default delegates to the real one,
 * which with no apex configured emits the path form this file has always
 * asserted. The override below is what pins the reason it exists: once a
 * merchant promotes a domain, the platform subdomain 308s, and a sitemap listed
 * at it is a sitemap a crawler has to follow twice to reach anything.
 */
vi.mock("@/shared/lib/shop-hostname", async (importActual) => ({
  ...(await importActual<typeof import("@/shared/lib/shop-hostname")>()),
  canonicalShopBase: canonicalShopBaseMock,
}))

canonicalShopBaseMock.mockImplementation(async (slug: string) => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/shop-hostname")
  >("@/shared/lib/shop-hostname")
  return actual.canonicalShopBase(slug)
})

vi.mock("@/features/shop/lib/shop-server", () => ({
  fetchShopShell: vi.fn((slug: string) => {
    if (slug === "acme") {
      return Promise.resolve({
        id: "shop_1",
        name: "Acme",
        slug: "acme",
        settings: {
          policies: {
            refund_policy: "Refunds accepted within 14 days",
            privacy_policy: "Privacy details here",
            terms_of_service: "Terms of service here",
            shipping_policy: "Shipping within 3 days",
          },
        },
      })
    }
    return Promise.resolve(null)
  }),
}))

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          storefrontProducts: {
            data: [{ slug: "mug" }, { slug: "t-shirt" }],
            meta: { total_pages: 1 },
          },
        },
      }),
  } as unknown as Response),
)

describe("GET /[shopSlug]/sitemap.xml", () => {
  afterEach(() => {
    canonicalShopBaseMock.mockImplementation(async (slug: string) => {
      const actual = await vi.importActual<
        typeof import("@/shared/lib/shop-hostname")
      >("@/shared/lib/shop-hostname")
      return actual.canonicalShopBase(slug)
    })
  })

  it("returns 404 for non-existent shop", async () => {
    const res = await GET(new Request("http://localhost:3003/invalid/sitemap.xml"), {
      params: Promise.resolve({ shopSlug: "invalid" }),
    })
    expect(res.status).toBe(404)
  })

  it("emits valid XML sitemap with shop, policies, and products", async () => {
    const res = await GET(new Request("http://localhost:3003/acme/sitemap.xml"), {
      params: Promise.resolve({ shopSlug: "acme" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("application/xml")

    const xml = await res.text()
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain("<loc>http://localhost:3003/acme</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/products</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/policies/refund</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/policies/privacy</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/policies/terms</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/policies/shipping</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/products/mug</loc>")
    expect(xml).toContain("<loc>http://localhost:3003/acme/products/t-shirt</loc>")
  })

  it("lists every URL at the shop's promoted domain once it has one", async () => {
    canonicalShopBaseMock.mockResolvedValue("https://acme.com")

    const res = await GET(new Request("https://acme.com/sitemap.xml"), {
      params: Promise.resolve({ shopSlug: "acme" }),
    })
    const xml = await res.text()

    expect(canonicalShopBaseMock).toHaveBeenCalledWith("acme")
    expect(xml).toContain("<loc>https://acme.com</loc>")
    expect(xml).toContain("<loc>https://acme.com/products</loc>")
    expect(xml).toContain("<loc>https://acme.com/products/mug</loc>")
    expect(xml).toContain("<loc>https://acme.com/policies/refund</loc>")
    // Nothing left pointing at the address that now redirects.
    expect(xml).not.toContain("localhost:3003")
  })
})
