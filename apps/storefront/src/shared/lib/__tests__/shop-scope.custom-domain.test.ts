// @vitest-environment-options {"url": "https://nikestore.com/products/blue-mug"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The browser on a merchant's own domain, end to end.
 *
 * The reported failure, from the API's logs: on a product page, `cart`,
 * `shopPaymentOptions`, `reviews`, `storefrontRecommendations`,
 * `negotiationAvailable` and the catalogue's next `storefrontProducts` page all
 * arrived with **no `X-SHOP`** and were refused `MISSING_SHOP_HEADER` — while
 * the `storefrontProduct`, `tags` and `collections` the server rendered the
 * same page with, and the proxy's `domainRequest` lookups beside them, were
 * fine. That split is the signature of a custom domain: the proxy resolved
 * `nikestore.com` to Nike from the back-end's verdict and rewrote the request,
 * but the browser re-derives the shop from `location` alone, and the string
 * `nikestore.com/products/blue-mug` names no shop at all.
 *
 * This file runs with jsdom's address set to that URL and a real apex
 * configured, which is the production shape: the host is not ours, so
 * `resolveTenant` rightly refuses to read the path — the shop has to come from
 * the attribute the root layout rendered.
 */

const ROOT = "zaydak.com"

type ShopScope = typeof import("@/shared/lib/shop-scope")
type Tenant = typeof import("@/shared/lib/tenant")

let scope: ShopScope
let tenant: Tenant

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", ROOT)
  vi.resetModules()
  scope = await import("@/shared/lib/shop-scope")
  tenant = await import("@/shared/lib/tenant")
}, 60_000)

afterEach(() => {
  document.documentElement.removeAttribute("data-host-shop")
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** What the root layout renders for a host-mode request. */
function renderedFor(slug: string) {
  document.documentElement.setAttribute(tenant.HOST_SHOP_ATTRIBUTE, slug)
}

it("is really running on the custom domain", () => {
  expect(window.location.host).toBe("nikestore.com")
  expect(window.location.pathname).toBe("/products/blue-mug")
})

describe("currentTenant on a custom domain", () => {
  it("names no shop without the attribute — the reported failure", () => {
    expect(scope.currentShopSlug()).toBeNull()
  })

  it("scopes to the shop the proxy resolved once the layout has said so", () => {
    renderedFor("nike")

    expect(scope.currentTenant()).toEqual({ mode: "host", slug: "nike", base: "" })
    expect(scope.currentShopSlug()).toBe("nike")
  })

  it("does not read the first path segment as the shop", () => {
    // Without the attribute and without an apex this would be `products`.
    renderedFor("nike")
    window.history.replaceState(null, "", "/beta/checkout")
    try {
      expect(scope.currentShopSlug()).toBe("nike")
    } finally {
      window.history.replaceState(null, "", "/products/blue-mug")
    }
  })

  it("builds shop links without a slug prefix on the shop's own domain", () => {
    // `forceLogout` and the error link land here. `/nike/login` on
    // `nikestore.com` is rewritten to `/nike/nike/login` and 404s — an expired
    // session became a dead end instead of a sign-in form.
    renderedFor("nike")

    expect(scope.shopPathFor("nike", "/login?expired=1")).toBe("/login?expired=1")
    expect(scope.shopPathFor("acme", "/cart")).toBe("/acme/cart")
  })
})

describe("the Apollo link on a custom domain", () => {
  let apollo: typeof import("@apollo/client")
  let links: typeof import("@/shared/apollo/links")

  // Imported here rather than inside a test: a cold transform of Apollo can
  // outlast a test's timeout, and a query still in flight from a timed-out
  // test would land on the next test's fetch stub.
  beforeEach(async () => {
    apollo = await import("@apollo/client")
    links = await import("@/shared/apollo/links")
  }, 60_000)

  async function headersOfOneQuery(): Promise<Headers> {
    const fetchMock = vi.fn<
      (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ data: { cart: null } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { ApolloClient, InMemoryCache, gql } = apollo
    const { composeLinks } = links

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: composeLinks(),
    })
    await client.query({
      // A field `CartResponse` has: codegen reads this file's documents too,
      // and `id` (which it has not) stopped the storefront's codegen.
      query: gql`
        query Cart {
          cart {
            success
          }
        }
      `,
      fetchPolicy: "network-only",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    return new Headers(fetchMock.mock.calls[0]![1]?.headers)
  }

  it("sends no X-SHOP when the layout named no shop — the reported failure", async () => {
    const headers = await headersOfOneQuery()
    expect(headers.get("x-shop")).toBeNull()
  })

  it("sends X-SHOP for the shop the page was rendered for", async () => {
    renderedFor("nike")

    const headers = await headersOfOneQuery()

    expect(headers.get("x-shop")).toBe("nike")
    // The same read decides the storefront marker, so a sign-in on the custom
    // domain is bound to this shop rather than left unbound.
    expect(headers.get("x-storefront")).toBe("1")
  })
})
