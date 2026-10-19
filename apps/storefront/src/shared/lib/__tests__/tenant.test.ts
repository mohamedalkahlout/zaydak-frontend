import { describe, expect, it } from "vitest"

import {
  hostServesPathTenants,
  hostTenant,
  internalPath,
  NO_TENANT,
  pathTenant,
  productSlugFromPath,
  resolveDocumentTenant,
  resolveTenant,
  shopRelativePath,
  shopHomeHref,
} from "../tenant"

const ROOT = "zaydak.com"
const at = (host: string | null, pathname: string) =>
  resolveTenant(host, pathname, ROOT)

describe("resolveTenant", () => {
  describe("host mode", () => {
    it("takes the shop off the hostname and leaves the path alone", () => {
      expect(at("nike.zaydak.com", "/products/blue-mug")).toEqual({
        mode: "host",
        slug: "nike",
        base: "",
      })
    })

    it("wins over anything the path might look like", () => {
      // The trap this whole module exists for: on a tenant host the first
      // segment is a SECTION, not a shop. Reading it as a shop would send
      // `X-SHOP: products` and un-gate /checkout in the same move.
      expect(at("nike.zaydak.com", "/checkout").slug).toBe("nike")
      expect(at("nike.zaydak.com", "/products").slug).toBe("nike")
      expect(at("nike.zaydak.com", "/acme/products").slug).toBe("nike")
    })

    it("resolves the shop home at /", () => {
      expect(at("nike.zaydak.com", "/")).toEqual({
        mode: "host",
        slug: "nike",
        base: "",
      })
    })
  })

  describe("path mode", () => {
    it("takes the shop off the first path segment on the apex", () => {
      expect(at("zaydak.com", "/acme/products/blue-mug")).toEqual({
        mode: "path",
        slug: "acme",
        base: "/acme",
      })
    })

    it("keeps working on a dev host outside the apex", () => {
      // Backward compatibility, stated as a test: development and health-check
      // hosts still read the shop out of the path.
      expect(at("shop.localhost:3003", "/acme/cart")).toEqual({
        mode: "path",
        slug: "acme",
        base: "/acme",
      })
      expect(at("127.0.0.1:3003", "/acme/cart").slug).toBe("acme")
    })

    it("serves the path shop under a reserved label", () => {
      // `www` is not a shop, so the path is the only thing left that can name
      // one. A 404 here would break the apex's own alias.
      expect(at("www.zaydak.com", "/acme")).toEqual({
        mode: "path",
        slug: "acme",
        base: "/acme",
      })
    })

    it("has no shop at the marketplace root", () => {
      expect(at("zaydak.com", "/")).toEqual(NO_TENANT)
      expect(at("www.zaydak.com", "/")).toEqual(NO_TENANT)
    })
  })

  it("falls back to path mode when no root domain is configured", () => {
    expect(resolveTenant("nike.zaydak.com", "/acme/cart", null)).toEqual({
      mode: "path",
      slug: "acme",
      base: "/acme",
    })
  })

  it("falls back to path mode when there is no host header at all", () => {
    // A direct render, an internal fetch, a test. HTTP gives nobody a way to
    // send this, so there is nothing to defend against and refusing would only
    // break the RSC tree.
    expect(at(null, "/acme/cart").slug).toBe("acme")
    expect(at("", "/acme/cart").slug).toBe("acme")
  })
})

describe("an unknown host names no shop", () => {
  // The hole this closes: the path fallback used to run for EVERY host the
  // apex check did not claim, so a domain parked on our IP, an unverified one
  // a merchant set DNS for and abandoned, or a forged `Host` served
  // `/acme/checkout` as Acme's checkout.

  it("refuses to read a shop out of a deep path", () => {
    expect(at("parked.example", "/acme/checkout")).toEqual(NO_TENANT)
    expect(at("parked.example", "/acme/products/blue-mug")).toEqual(NO_TENANT)
    expect(at("zaydak.vercel.app", "/acme/cart")).toEqual(NO_TENANT)
  })

  it("refuses a host header that is present but unreadable", () => {
    // The opposite case to a missing header: a `Host` shaped to make two
    // parsers disagree about where the hostname ends is exactly the input that
    // must not be given the benefit of the doubt.
    expect(at("not a host", "/acme/cart")).toEqual(NO_TENANT)
    expect(at("evil.com/../acme", "/acme/cart")).toEqual(NO_TENANT)
  })

  it("still resolves nothing at the marketplace root", () => {
    expect(at("parked.example", "/")).toEqual(NO_TENANT)
  })

  it("leaves a custom merchant domain to the verdict, not the path", () => {
    // `nikestore.com` IS a shop's address, but nothing in the string says so.
    // Resolving it is `proxy.ts`'s job, from the back-end's verdict — and what
    // matters here is that the path does not get to answer in the meantime.
    expect(at("nikestore.com", "/products/mug")).toEqual(NO_TENANT)
    expect(at("nikestore.com", "/beta/checkout")).toEqual(NO_TENANT)
  })
})

describe("resolveDocumentTenant — the browser's half of the custom-domain lookup", () => {
  // `resolveTenant` answers NO_TENANT on a merchant's own domain, correctly —
  // the string names no shop. The proxy then names it from the back-end's
  // verdict, and before `HOST_SHOP_ATTRIBUTE` that answer never reached the
  // browser: every client query on `nikestore.com` (cart, reviews, payment
  // options, recommendations, the catalogue's next page) went out with no
  // `X-SHOP` and was refused MISSING_SHOP_HEADER, while the server-rendered
  // half of the same page worked.
  const doc = (host: string | null, pathname: string, hostShop: string | null) =>
    resolveDocumentTenant(host, pathname, hostShop, ROOT)

  it("scopes a custom domain to the shop the proxy resolved it to", () => {
    expect(doc("nikestore.com", "/products/blue-mug", "nike")).toEqual({
      mode: "host",
      slug: "nike",
      base: "",
    })
    expect(doc("nikestore.com", "/", "nike")).toEqual(hostTenant("nike"))
  })

  it("does not let the path name a different shop on that domain", () => {
    // The proxy rewrites `nikestore.com/beta/checkout` to `/nike/beta/checkout`;
    // the browser has to agree with it, not with the first segment.
    expect(doc("nikestore.com", "/beta/checkout", "nike").slug).toBe("nike")
  })

  it("is the old NO_TENANT without the attribute — the reported failure", () => {
    expect(doc("nikestore.com", "/products/blue-mug", null)).toEqual(NO_TENANT)
  })

  it("leaves a host that names a shop by reading to the string", () => {
    // Same precedence as the proxy, which only consults the verdict when the
    // host string did not already name a shop.
    expect(doc("acme.zaydak.com", "/cart", "acme")).toEqual(hostTenant("acme"))
    expect(doc("acme.zaydak.com", "/cart", "other")).toEqual(hostTenant("acme"))
  })

  it("changes nothing in path mode, where no attribute is rendered", () => {
    expect(doc("zaydak.com", "/acme/products/mug", null)).toEqual(
      pathTenant("acme"),
    )
    expect(doc("zaydak.com", "/", null)).toEqual(NO_TENANT)
  })

  it("stops a subdomain reading its first section as the shop when no apex is configured", () => {
    // A client bundle built without NEXT_PUBLIC_ROOT_DOMAIN cannot read
    // `acme.zaydak.com` either; the proxy still resolved it from the verdict.
    expect(
      resolveDocumentTenant("acme.zaydak.com", "/products/mug", "acme", null),
    ).toEqual(hostTenant("acme"))
    expect(
      resolveDocumentTenant("acme.zaydak.com", "/products/mug", null, null).slug,
    ).toBe("products")
  })
})

describe("hostServesPathTenants", () => {
  it("allows the apex and everything under it", () => {
    expect(hostServesPathTenants("zaydak.com", ROOT)).toBe(true)
    expect(hostServesPathTenants("www.zaydak.com", ROOT)).toBe(true)
    expect(hostServesPathTenants("a.b.zaydak.com", ROOT)).toBe(true)
    expect(hostServesPathTenants("ZAYDAK.COM.:3003", ROOT)).toBe(true)
  })

  it("allows development and health-check hosts", () => {
    for (const host of ["localhost:3003", "shop.localhost", "127.0.0.1", "[::1]:3003"]) {
      expect(hostServesPathTenants(host, ROOT)).toBe(true)
    }
  })

  it("refuses a stranger", () => {
    expect(hostServesPathTenants("parked.example", ROOT)).toBe(false)
    expect(hostServesPathTenants("nikestore.com", ROOT)).toBe(false)
  })

  it("allows everything when no apex is configured", () => {
    // The escape hatch, and it is the one that keeps a deployment on the air:
    // `ROOT_DOMAIN` defaults to `localhost`, so an operator who never set
    // `NEXT_PUBLIC_ROOT_DOMAIN` cannot tell their own apex from a stranger's
    // host. Tightening there would 404 the whole storefront.
    expect(hostServesPathTenants("parked.example", null)).toBe(true)
    expect(resolveTenant("parked.example", "/acme/cart", null)).toEqual({
      mode: "path",
      slug: "acme",
      base: "/acme",
    })
  })
})

describe("base — the prefix every in-app link is built from", () => {
  it("is empty in host mode so a link is already shop-relative", () => {
    const t = hostTenant("nike")
    expect(`${t.base}/cart`).toBe("/cart")
    expect(`${t.base}/products/mug`).toBe("/products/mug")
    expect(`${t.base}/`).toBe("/")
  })

  it("is the slug segment in path mode", () => {
    const t = pathTenant("acme")
    expect(`${t.base}/cart`).toBe("/acme/cart")
    expect(`${t.base}/products/mug`).toBe("/acme/products/mug")
    expect(`${t.base}/`).toBe("/acme/")
  })

  it("shopHomeHref has no extra slash so next/link SSR and client agree", () => {
    expect(shopHomeHref(pathTenant("acme").base)).toBe("/acme")
    expect(shopHomeHref(hostTenant("nike").base)).toBe("/")
    expect(shopHomeHref(NO_TENANT.base)).toBe("/")
  })

  it("never carries a trailing slash", () => {
    expect(pathTenant("acme").base.endsWith("/")).toBe(false)
    expect(hostTenant("nike").base.endsWith("/")).toBe(false)
    expect(NO_TENANT.base).toBe("")
  })
})

describe("shopRelativePath", () => {
  it("strips the slug segment in path mode", () => {
    const t = pathTenant("acme")
    expect(shopRelativePath("/acme/products/mug", t)).toBe("/products/mug")
    expect(shopRelativePath("/acme", t)).toBe("/")
    expect(shopRelativePath("/acme/", t)).toBe("/")
  })

  it("leaves an already shop-relative path alone in host mode", () => {
    const t = hostTenant("nike")
    expect(shopRelativePath("/products/mug", t)).toBe("/products/mug")
    expect(shopRelativePath("/", t)).toBe("/")
  })

  it("does not strip a segment that merely starts with the slug", () => {
    expect(shopRelativePath("/acmeco/products", pathTenant("acme"))).toBe(
      "/acmeco/products",
    )
  })
})

describe("internalPath — what the proxy rewrites to", () => {
  it("prefixes the slug in host mode", () => {
    expect(internalPath("/products/mug", hostTenant("nike"))).toBe(
      "/nike/products/mug",
    )
    expect(internalPath("/checkout", hostTenant("nike"))).toBe("/nike/checkout")
  })

  it("maps the shop home to the bare slug, never a trailing slash", () => {
    // `/nike/` and `/nike` are different cache keys and one of them is not a
    // route. The layout's own canonical redirect compares against `/nike`.
    expect(internalPath("/", hostTenant("nike"))).toBe("/nike")
  })

  it("is a no-op in path mode", () => {
    // The load-bearing property: every address that worked before this feature
    // passes through the proxy untouched.
    expect(internalPath("/acme/products/mug", pathTenant("acme"))).toBe(
      "/acme/products/mug",
    )
    expect(internalPath("/", NO_TENANT)).toBe("/")
  })

  it("round-trips with shopRelativePath in both modes", () => {
    for (const t of [hostTenant("nike"), pathTenant("nike")]) {
      for (const path of ["/", "/cart", "/products/blue-mug"]) {
        const publicPath = t.base + (path === "/" ? "" : path) || "/"
        expect(shopRelativePath(publicPath, t)).toBe(path)
        expect(internalPath(publicPath, t)).toBe(
          path === "/" ? "/nike" : `/nike${path}`,
        )
      }
    }
  })
})

describe("productSlugFromPath", () => {
  /**
   * What the assistant panel sends as its page context. A floating window over
   * a product page that could not see the page was asking shoppers which item
   * they meant, and taking a pasted URL slug as the answer.
   */
  it("reads the product off a product page", () => {
    expect(productSlugFromPath("/products/blue-mug")).toBe("blue-mug")
    expect(productSlugFromPath("/products/blue-mug?variant=2")).toBe("blue-mug")
    expect(productSlugFromPath("/products/blue-mug#reviews")).toBe("blue-mug")
  })

  it("decodes a slug that travelled encoded", () => {
    expect(productSlugFromPath("/products/%D8%A8%D9%8A%D8%B6")).toBe("بيض")
  })

  it("is null anywhere that is not one product", () => {
    expect(productSlugFromPath("/products")).toBeNull()
    expect(productSlugFromPath("/")).toBeNull()
    expect(productSlugFromPath("/cart")).toBeNull()
    // Shop-relative only: a path-mode URL must be stripped first, or the shop
    // slug would be read as a product.
    expect(productSlugFromPath("/acme/products/blue-mug")).toBeNull()
  })

  it("composes with shopRelativePath in both modes", () => {
    expect(
      productSlugFromPath(
        shopRelativePath("/acme/products/blue-mug", pathTenant("acme")),
      ),
    ).toBe("blue-mug")
    expect(
      productSlugFromPath(
        shopRelativePath("/products/blue-mug", hostTenant("acme")),
      ),
    ).toBe("blue-mug")
  })
})
