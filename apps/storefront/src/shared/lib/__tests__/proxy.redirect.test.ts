import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The platform subdomain bouncing to a promoted custom domain, end to end.
 *
 * Asserted against the real `proxy` rather than the verdict helper, because the
 * three things that can go wrong here are all in the translation: the status
 * code a crawler reads, whether the visitor keeps the page and campaign tag
 * they arrived with, and whether the request loops forever. The verdict itself
 * is decided in the back-end and tested there.
 */

const { resolveDomainRequest } = vi.hoisted(() => ({
  resolveDomainRequest: vi.fn(),
}))

// Only the network call is replaced. `worthResolving` stays real, because it is
// half of the gate under test — it is what keeps the marketplace apex from ever
// being a redirect source, and a stub saying "yes" would have hidden that.
vi.mock("@/shared/lib/domain-request", async (importActual) => ({
  ...(await importActual<typeof import("@/shared/lib/domain-request")>()),
  resolveDomainRequest,
}))

const ROOT = "zaydak.com"

/** A request, shaped enough for the proxy to read what it reads. */
function request(host: string, url: string) {
  const parsed = new URL(url)
  return {
    headers: new Headers({ host }),
    nextUrl: {
      pathname: parsed.pathname,
      search: parsed.search,
      searchParams: parsed.searchParams,
      clone: () => new URL(parsed.toString()),
    },
    url: parsed.toString(),
    cookies: {
      get: () => undefined,
      has: () => false,
    },
  } as never
}

const redirecting = () =>
  resolveDomainRequest.mockResolvedValue({
    slug: "nike",
    role: "PLATFORM",
    action: "REDIRECT",
    primaryHostname: "nikestore.com",
  })

describe("proxy — redirect to the primary domain", () => {
  let proxy: (req: never) => Promise<Response>
  let config: { matcher: string[] }

  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", ROOT)
    vi.resetModules()
    resolveDomainRequest.mockReset()
    ;({ proxy, config } = await import("@/proxy"))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sends a 308, not a 302", async () => {
    // Permanent, so a crawler learns the primary domain is the real address —
    // which is the point of promoting one. And `8` rather than `1` preserves
    // the method, so a POST in flight is not silently downgraded to a GET.
    redirecting()

    const response = await proxy(
      request("nike.zaydak.com", "https://nike.zaydak.com/products/mug"),
    )

    expect(response.status).toBe(308)
  })

  it("keeps the path and the query string", async () => {
    // The one thing the visitor actually asked for, and the merchant's campaign
    // tracking with it. An advert that lands on an untracked home page is money
    // spent invisibly.
    redirecting()

    const response = await proxy(
      request(
        "nike.zaydak.com",
        "https://nike.zaydak.com/products/123?ref=ad&utm_source=x",
      ),
    )

    expect(response.headers.get("location")).toBe(
      "https://nikestore.com/products/123?ref=ad&utm_source=x",
    )
  })

  it("always lands on https", async () => {
    redirecting()
    const response = await proxy(
      request("nike.zaydak.com", "http://nike.zaydak.com/cart"),
    )
    expect(response.headers.get("location")).toBe("https://nikestore.com/cart")
  })

  it("serves normally when there is nothing to redirect to", async () => {
    resolveDomainRequest.mockResolvedValue({
      slug: "nike",
      role: "PRIMARY",
      action: "SERVE",
    })

    const response = await proxy(
      request("nike.zaydak.com", "https://nike.zaydak.com/products/mug"),
    )

    expect(response.status).not.toBe(308)
  })

  it("serves when the back-end could not be reached at all", async () => {
    // Degrading to the behaviour the storefront had before redirects existed.
    // An API blip must not take the shop off its own address.
    resolveDomainRequest.mockResolvedValue(null)

    const response = await proxy(
      request("nike.zaydak.com", "https://nike.zaydak.com/"),
    )

    expect(response.status).not.toBe(308)
  })

  describe("loop safety", () => {
    it("refuses to redirect a host to itself", async () => {
      // The back-end guarantees this never happens and the verdict parser drops
      // it if it does. This is the third check, and it is the one standing
      // between a regression and a page that shows the visitor nothing at all.
      resolveDomainRequest.mockResolvedValue({
        slug: "nike",
        role: "PRIMARY",
        action: "REDIRECT",
        primaryHostname: "nikestore.com",
      })

      const response = await proxy(
        request("nikestore.com", "https://nikestore.com/products/mug"),
      )

      expect(response.status).not.toBe(308)
    })

    it("ignores the port when comparing", async () => {
      resolveDomainRequest.mockResolvedValue({
        slug: "nike",
        role: "PRIMARY",
        action: "REDIRECT",
        primaryHostname: "nikestore.com",
      })

      const response = await proxy(
        request("nikestore.com:3003", "https://nikestore.com:3003/"),
      )

      expect(response.status).not.toBe(308)
    })
  })

  describe("the apex is never a redirect source", () => {
    it("does not even ask about the marketplace host", async () => {
      await proxy(request(ROOT, `https://${ROOT}/`))
      expect(resolveDomainRequest).not.toHaveBeenCalled()
    })

    it("does not ask about a path-mode shop URL", async () => {
      // `zaydak.com/nike/products/mug` is the marketplace's own browsing
      // surface. Redirecting it would send every click in the shop directory
      // off the marketplace, which is a product decision nobody has made.
      await proxy(request(ROOT, `https://${ROOT}/nike/products/mug`))

      expect(resolveDomainRequest).not.toHaveBeenCalled()
    })
  })

  describe("a custom domain serves every path, not just the home page", () => {
    // The failure this feature nearly shipped on top of. `resolveTenant` falls
    // back to reading the shop out of the first path segment, so the verdict
    // gate used to skip the lookup for any path except "/" — and a promoted
    // domain 404d everywhere the 308 sent people.
    beforeEach(() => {
      resolveDomainRequest.mockResolvedValue({
        slug: "nike",
        role: "PRIMARY",
        action: "SERVE",
      })
    })

    it("asks for the verdict on a deep path", async () => {
      await proxy(request("nikestore.com", "https://nikestore.com/products/mug"))
      expect(resolveDomainRequest).toHaveBeenCalledWith("nikestore.com")
    })

    it("rewrites the deep path under the shop the HOST names", async () => {
      const response = await proxy(
        request("nikestore.com", "https://nikestore.com/products/mug"),
      )

      // Not `/products/products/mug`, and not a shop called `products`.
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/nike/products/mug",
      )
    })

    it("does not let the path name a different shop", async () => {
      // `nikestore.com/beta/checkout` used to be scoped to the shop `beta` —
      // one merchant's storefront served on another merchant's domain.
      const response = await proxy(
        request("nikestore.com", "https://nikestore.com/beta/checkout"),
      )

      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/nike/beta/checkout",
      )
    })

    it("hands the resolved shop to the server tree for the browser", async () => {
      // The root layout writes this on `<html>`, and it is the only way the
      // browser learns which shop a custom domain serves. Without it every
      // client query on `nikestore.com` went out with no `X-SHOP`.
      const response = await proxy(
        request("nikestore.com", "https://nikestore.com/products/mug"),
      )

      expect(
        response.headers.get("x-middleware-request-x-storefront-tenant-mode"),
      ).toBe("host")
      expect(
        response.headers.get("x-middleware-request-x-storefront-tenant-slug"),
      ).toBe("nike")
    })
  })

  describe("the tenant headers are the proxy's to set", () => {
    it("drops a forged shop header on a path-mode request", async () => {
      const req = request(ROOT, `https://${ROOT}/acme/products/mug`) as unknown as {
        headers: Headers
      }
      req.headers.set("x-storefront-tenant-slug", "evil")
      req.headers.set("x-storefront-tenant-host", "evil.zaydak.com")

      const response = await proxy(req as never)

      expect(
        response.headers.get("x-middleware-request-x-storefront-tenant-mode"),
      ).toBe("path")
      expect(
        response.headers.get("x-middleware-request-x-storefront-tenant-slug"),
      ).toBeNull()
      expect(
        response.headers.get("x-middleware-request-x-storefront-tenant-host"),
      ).toBeNull()
    })

    it("stamps a platform subdomain's own handle", async () => {
      resolveDomainRequest.mockResolvedValue({
        slug: "nike",
        role: "PLATFORM",
        action: "SERVE",
      })

      const response = await proxy(
        request("nike.zaydak.com", "https://nike.zaydak.com/cart"),
      )

      expect(
        response.headers.get("x-middleware-request-x-storefront-tenant-slug"),
      ).toBe("nike")
    })
  })

  describe("a host that names no shop", () => {
    // The hole: `resolveTenant` used to read the shop out of the first path
    // segment for ANY host the apex check did not claim, so a parked domain
    // pointed at this deployment, an unverified one a merchant set DNS for and
    // abandoned, or a forged `Host` served `/acme/checkout` as Acme's checkout.
    beforeEach(() => {
      resolveDomainRequest.mockResolvedValue(null)
    })

    it("refuses a shop page outright", async () => {
      const response = await proxy(
        request("parked.example", "https://parked.example/acme/checkout"),
      )

      expect(response.status).toBe(404)
    })

    it("does not rewrite it into somebody's shop instead", async () => {
      // The reason the refusal has to be here and not only in `resolveTenant`:
      // with no tenant there is nothing to rewrite, so Next would match
      // `/acme/products/mug` against the `[shopSlug]` tree anyway — and the
      // route guard, handed `shopSlug: null`, would gate nothing.
      const response = await proxy(
        request("parked.example", "https://parked.example/acme/products/mug"),
      )

      expect(response.status).toBe(404)
      expect(response.headers.get("x-middleware-rewrite")).toBeNull()
    })

    it("still answers at the root, where a health check asks", async () => {
      const response = await proxy(
        request("parked.example", "https://parked.example/"),
      )

      expect(response.status).not.toBe(404)
    })

    it("leaves the apex alone", async () => {
      const response = await proxy(request(ROOT, `https://${ROOT}/acme/checkout`))
      expect(response.status).not.toBe(404)
    })

    it("leaves a platform subdomain alone", async () => {
      const response = await proxy(
        request("nike.zaydak.com", "https://nike.zaydak.com/checkout"),
      )
      expect(response.status).not.toBe(404)
    })

    it("serves a custom domain the verdict does name", async () => {
      // The same unreadable-host shape, resolved the only way it can be: from
      // the back-end's verdict, never from the path.
      resolveDomainRequest.mockResolvedValue({
        slug: "nike",
        role: "PRIMARY",
        action: "SERVE",
      })

      const response = await proxy(
        request("nikestore.com", "https://nikestore.com/beta/checkout"),
      )

      expect(response.status).not.toBe(404)
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        "/nike/beta/checkout",
      )
    })
  })

  describe("the domain probe must never be redirected", () => {
    it("is excluded by the matcher, so an alias can still verify", () => {
      // Not a behaviour of `proxy` but of the matcher in front of it, and it is
      // load-bearing: the back-end proves a domain is served by fetching
      // `/api/domain-probe` with redirect handling off, so a redirect there is
      // a failure. An alias redirects — that is its job — so if this pattern
      // ever covered `/api/*`, every alias would fail its probe and the nightly
      // sweep would demote all of them. Nothing else would point here.
      const matcher = new RegExp(`^${config.matcher[0]}$`)

      expect(matcher.test("/api/domain-probe")).toBe(false)
      expect(matcher.test("/monitoring")).toBe(false)
      expect(matcher.test("/products/mug")).toBe(true)
    })
  })
})
