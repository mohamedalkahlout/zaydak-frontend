import { describe, it, expect, vi, beforeEach } from "vitest"
import ProductPage, { generateMetadata } from "../page"

const notFoundMock = vi.hoisted(() => vi.fn())
const fetchProductMetaMock = vi.hoisted(() => vi.fn())
const fetchShopShellMock = vi.hoisted(() => vi.fn())
const getLocaleMock = vi.hoisted(() => vi.fn(() => Promise.resolve("en")))
const canonicalShopBaseMock = vi.hoisted(() => vi.fn())

/**
 * The one thing the page cannot derive: which address this shop publishes at.
 *
 * A promoted custom domain is a row in the database, so it is looked up
 * (`shared/lib/shop-hostname.ts`) and threaded into the canonical tag and the
 * JSON-LD `Offer.url` alike. Only the lookup is replaced here — the default
 * below delegates to the real implementation, so the "nothing changes for a
 * shop without one" case is pinned against real code rather than against a
 * stub that agrees with it.
 */
vi.mock("@/shared/lib/shop-hostname", async (importActual) => ({
  ...(await importActual<typeof import("@/shared/lib/shop-hostname")>()),
  canonicalShopBase: canonicalShopBaseMock,
}))

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}))

vi.mock("next-intl/server", () => ({
  getLocale: getLocaleMock,
}))

vi.mock("@/features/catalog/lib/product-server", () => ({
  fetchProductMeta: fetchProductMetaMock,
}))

vi.mock("@/features/shop/lib/shop-server", () => ({
  fetchShopShell: fetchShopShellMock,
}))

vi.mock("@/shared/apollo/rsc", () => ({
  PreloadQuery: ({ children, query, variables }: any) => (
    <div data-testid="preload-query" data-query={query} data-variables={JSON.stringify(variables)}>
      {children}
    </div>
  ),
  storefrontContext: (slug: string) => ({ shopSlug: slug }),
}))

/** The real resolver, which with no apex configured emits the path form. */
async function realCanonicalBase(slug: string) {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/shop-hostname")
  >("@/shared/lib/shop-hostname")
  return actual.canonicalShopBase(slug)
}

describe("ProductPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canonicalShopBaseMock.mockImplementation(realCanonicalBase)
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
  })

  it("calls notFound() when fetchProductMeta returns null for an invalid product slug", async () => {
    fetchProductMetaMock.mockResolvedValueOnce(null)

    await expect(
      ProductPage({
        params: Promise.resolve({ shopSlug: "test-shop", slug: "missing-slug" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND")

    expect(fetchProductMetaMock).toHaveBeenCalledWith("test-shop", "missing-slug")
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it("renders PreloadQuery when product is found", async () => {
    fetchProductMetaMock.mockResolvedValueOnce({
      id: "prod-1",
      slug: "awesome-mug",
      name: { en: "Awesome Mug" },
    })

    const element = await ProductPage({
      params: Promise.resolve({ shopSlug: "test-shop", slug: "awesome-mug" }),
    })

    expect(element).toBeDefined()
    expect(notFoundMock).not.toHaveBeenCalled()
    expect(fetchProductMetaMock).toHaveBeenCalledWith("test-shop", "awesome-mug")
  })

  it("gives the JSON-LD the shop's promoted domain, not the derived one", async () => {
    // `Offer.url`, the canonical tag and the sitemap entry are three places
    // that must never disagree about a product's address. Once a merchant
    // promotes a domain the platform subdomain 308s, so naming it here would
    // put a redirect inside the structured data.
    canonicalShopBaseMock.mockResolvedValue("https://acme.com")
    fetchProductMetaMock.mockResolvedValueOnce({
      id: "prod-1",
      slug: "awesome-mug",
      name: { en: "Awesome Mug" },
    })
    fetchShopShellMock.mockResolvedValueOnce({ name: "Acme Shop", slug: "acme" })

    const element = (await ProductPage({
      params: Promise.resolve({ shopSlug: "acme", slug: "awesome-mug" }),
    })) as { props: { children: { props: { shopUrl: string } }[] } }

    expect(canonicalShopBaseMock).toHaveBeenCalledWith("acme")
    expect(element.props.children[0]!.props.shopUrl).toBe("https://acme.com")
  })
})

describe("generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canonicalShopBaseMock.mockImplementation(realCanonicalBase)
  })

  it("names the shop's promoted domain in the canonical tag", async () => {
    canonicalShopBaseMock.mockResolvedValue("https://acme.com")
    fetchProductMetaMock.mockResolvedValueOnce({
      id: "prod-1",
      slug: "awesome-mug",
      name: { en: "Awesome Mug" },
    })
    fetchShopShellMock.mockResolvedValueOnce({ name: "Acme Shop", slug: "acme" })

    const meta = await generateMetadata({
      params: Promise.resolve({ shopSlug: "acme", slug: "awesome-mug" }),
    })

    expect(meta.alternates?.canonical).toBe("https://acme.com/products/awesome-mug")
  })

  it("emits the same URL as before for a shop with no promoted domain", async () => {
    // The bound on this change, stated as a test: with no apex configured —
    // the state of every deployment that never opted in — the canonical is
    // byte-for-byte the string this page emitted before promoted domains
    // existed, and the resolver reaches no network to decide it.
    fetchProductMetaMock.mockResolvedValueOnce({
      id: "prod-1",
      slug: "awesome-mug",
      name: { en: "Awesome Mug" },
    })
    fetchShopShellMock.mockResolvedValueOnce({ name: "Acme Shop", slug: "acme" })

    const meta = await generateMetadata({
      params: Promise.resolve({ shopSlug: "acme", slug: "awesome-mug" }),
    })

    expect(meta.alternates?.canonical).toBe(
      "http://localhost:3003/acme/products/awesome-mug",
    )
  })

  it("returns an empty object if product is not found", async () => {
    fetchProductMetaMock.mockResolvedValueOnce(null)
    fetchShopShellMock.mockResolvedValueOnce({ name: "Acme Shop" })

    const meta = await generateMetadata({
      params: Promise.resolve({ shopSlug: "test-shop", slug: "missing-slug" }),
    })

    expect(meta).toEqual({})
  })

  it("returns SEO metadata with openGraph and twitter cards when product exists", async () => {
    fetchProductMetaMock.mockResolvedValueOnce({
      id: "prod-1",
      slug: "awesome-mug",
      name: { en: "Awesome Mug" },
      seo_title: { en: "Custom Mug SEO Title" },
      seo_description: { en: "Custom SEO Description" },
      image: { original: "https://cdn.example.com/mug.jpg" },
    })
    fetchShopShellMock.mockResolvedValueOnce({ name: "Acme Shop" })

    const meta = await generateMetadata({
      params: Promise.resolve({ shopSlug: "test-shop", slug: "awesome-mug" }),
    })

    expect(meta.title).toBe("Custom Mug SEO Title")
    expect(meta.description).toBe("Custom SEO Description")
    expect(meta.openGraph).toMatchObject({
      title: "Custom Mug SEO Title",
      description: "Custom SEO Description",
      type: "website",
      siteName: "Acme Shop",
      images: [{ url: "https://cdn.example.com/mug.jpg", alt: "Awesome Mug" }],
    })
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Custom Mug SEO Title",
      description: "Custom SEO Description",
      images: ["https://cdn.example.com/mug.jpg"],
    })
  })
})
