import { describe, expect, it } from "vitest"

import { routeDecision } from "@/shared/auth/route-access"
import { accessCookie } from "@/shared/auth/cookie-names"
import { internalPath, resolveTenant } from "../tenant"
import { shopUrlBase } from "../site-url"

/**
 * The whole resolution chain, one request at a time.
 *
 * The unit tests either side of this cover the pieces; this covers the thing
 * that actually broke when the pieces disagreed. For each `Host` + path pair it
 * asserts all four facts a request depends on at once:
 *
 *   1. which shop it is scoped to      (the `X-SHOP` that goes out)
 *   2. which path the route tree sees  (the proxy's internal rewrite)
 *   3. which cookie the guard reads    (the session, named for the shop)
 *   4. whether the guard gates it      (checkout and account)
 *
 * They are asserted together on purpose. Every one of them is derived from the
 * same `resolveTenant` call, so when it is wrong they are wrong *simultaneously
 * and consistently* — the request looks coherent, names a shop that does not
 * exist, and nothing throws. A test per piece would have passed.
 */

const ROOT = "zaydak.com"

interface Case {
  host: string
  path: string
  /** The shop the request is scoped to, or null for the marketplace. */
  slug: string | null
  /** The path the Next route tree matches after the proxy is done. */
  internal: string
  /** Whether the route guard demands a session. */
  gated: boolean
}

function run(host: string, path: string) {
  const tenant = resolveTenant(host, path, ROOT)
  const decision = routeDecision({
    pathname: path,
    shopSlug: tenant.slug,
    base: tenant.base,
    token: undefined,
    expired: false,
  })
  return {
    slug: tenant.slug,
    internal: internalPath(path, tenant),
    cookie: tenant.slug ? accessCookie(tenant.slug) : null,
    gated: decision.type === "redirect",
    redirectTo: decision.type === "redirect" ? decision.to : null,
  }
}

describe("a request, end to end", () => {
  const cases: Case[] = [
    // ── The apex: exactly what this app did before shop hostnames existed ──
    { host: "zaydak.com", path: "/", slug: null, internal: "/", gated: false },
    {
      host: "zaydak.com",
      path: "/acme",
      slug: "acme",
      internal: "/acme",
      gated: false,
    },
    {
      host: "zaydak.com",
      path: "/acme/products/blue-mug",
      slug: "acme",
      internal: "/acme/products/blue-mug",
      gated: false,
    },
    {
      host: "zaydak.com",
      path: "/acme/checkout",
      slug: "acme",
      internal: "/acme/checkout",
      gated: true,
    },

    // ── A shop's own hostname: clean URLs, same route tree ──
    {
      host: "nike.zaydak.com",
      path: "/",
      slug: "nike",
      internal: "/nike",
      gated: false,
    },
    {
      host: "nike.zaydak.com",
      path: "/products/blue-mug",
      slug: "nike",
      internal: "/nike/products/blue-mug",
      gated: false,
    },
    {
      host: "nike.zaydak.com",
      path: "/checkout",
      slug: "nike",
      internal: "/nike/checkout",
      gated: true,
    },
    {
      host: "nike.zaydak.com",
      path: "/account/orders",
      slug: "nike",
      internal: "/nike/account/orders",
      gated: true,
    },

    // ── Case and trailing dot are normalised before anything else runs ──
    {
      host: "DEMO.ZAYDAK.COM.",
      path: "/products",
      slug: "demo",
      internal: "/demo/products",
      gated: false,
    },

    // ── Reserved labels are never a shop; the path decides, as on the apex ──
    {
      host: "www.zaydak.com",
      path: "/acme/cart",
      slug: "acme",
      internal: "/acme/cart",
      gated: false,
    },
    { host: "www.zaydak.com", path: "/", slug: null, internal: "/", gated: false },

    // ── A host that is not ours names no shop, whatever its path says ──
    // The path fallback used to run here too, so `parked.example/acme/checkout`
    // was Acme's checkout served from a domain with no claim to it. There is
    // nothing left for the guard to gate, because there is no shop: `proxy.ts`
    // refuses the request outright (`proxy.redirect.test.ts`).
    {
      host: "parked.example",
      path: "/acme/checkout",
      slug: null,
      internal: "/acme/checkout",
      gated: false,
    },

    // ── Local development ──
    {
      host: "shop1.localhost:3003",
      path: "/cart",
      // `localhost` is not the configured apex in these cases, so this host is
      // foreign and the path decides — `cart` is read as a shop. Covered so the
      // rule is visible rather than surprising; the *.localhost tenant case is
      // pinned in hostname.test.ts against a `localhost` apex.
      slug: "cart",
      internal: "/cart",
      gated: false,
    },
  ]

  it.each(cases)(
    "$host$path -> shop $slug, route $internal",
    ({ host, path, slug, internal, gated }) => {
      const result = run(host, path)
      expect(result.slug).toBe(slug)
      expect(result.internal).toBe(internal)
      expect(result.gated).toBe(gated)
    },
  )

  it("names the session cookie after the resolved shop, not a path segment", () => {
    // The failure this prevents: on a shop host the guard looked for
    // `shop_checkout_access_token` — a cookie nothing has ever written — so a
    // signed-in customer read as signed out on the one page that needs a
    // session.
    expect(run("nike.zaydak.com", "/checkout").cookie).toBe(
      accessCookie("nike"),
    )
    expect(run("zaydak.com", "/acme/checkout").cookie).toBe(accessCookie("acme"))
  })

  it("sends a gated request to a sign-in URL that exists on that host", () => {
    // On the apex the slug is in the path; on the shop's host it must not be,
    // or the visitor is bounced to a URL the proxy rewrites to `/nike/nike/...`.
    expect(run("zaydak.com", "/acme/checkout").redirectTo).toBe(
      "/acme/login?redirect=%2Facme%2Fcheckout",
    )
    expect(run("nike.zaydak.com", "/checkout").redirectTo).toBe(
      "/login?redirect=%2Fcheckout",
    )
  })

  it("never rewrites a request that arrived on the apex", () => {
    // The backward-compatibility guarantee, stated as an assertion: every
    // address that worked before this feature passes through untouched.
    for (const path of ["/", "/acme", "/acme/products", "/acme/account"]) {
      expect(run("zaydak.com", path).internal).toBe(path)
    }
  })

  it("does not read the first path segment as a shop on a shop host", () => {
    // The single most dangerous failure mode, pinned on its own: every one of
    // these would have resolved to a shop named after the section.
    for (const section of ["checkout", "account", "products", "cart", "login"]) {
      expect(run("nike.zaydak.com", `/${section}`).slug).toBe("nike")
    }
  })
})

describe("absolute URLs", () => {
  it("stays on the path form when no apex is configured", () => {
    // `NEXT_PUBLIC_ROOT_DOMAIN` is unset under test, which is the same state as
    // a deployment that has not opted in. Every canonical, OpenGraph URL and
    // sitemap entry must look exactly as it did before shop hostnames existed —
    // NOT `http://acme.localhost`, which is what the dev default would give if
    // the read path and the write path shared a variable.
    expect(shopUrlBase("acme")).toBe("http://localhost:3003/acme")
  })

  it("falls back to the site origin when there is no shop", () => {
    expect(shopUrlBase(null)).toBe("http://localhost:3003")
  })

  describe("a shop's promoted domain", () => {
    // The third address, and the only one that cannot be derived from the
    // handle: it is a row in the database, so it is handed in. Resolving it is
    // `canonicalShopBase`'s job (`shop-hostname.ts`); this function's job is to
    // prefer it and to refuse anything that is not a hostname.
    it("wins over the derived address when one is handed in", () => {
      expect(shopUrlBase("acme", "acme.com")).toBe("https://acme.com")
    })

    it("normalises it, because it arrived over the network", () => {
      expect(shopUrlBase("acme", "ACME.com.:443")).toBe("https://acme.com")
    })

    it("is ignored when it is not a readable hostname", () => {
      // It goes straight into a tag the whole world is told is canonical.
      for (const bad of ["", "   ", "not a host", "acme.com/../x", null]) {
        expect(shopUrlBase("acme", bad)).toBe("http://localhost:3003/acme")
      }
    })

    it("changes nothing for a shop that has not promoted one", () => {
      // The rule this whole change is bounded by: same call, same string.
      expect(shopUrlBase("acme", undefined)).toBe(shopUrlBase("acme"))
    })
  })
})
