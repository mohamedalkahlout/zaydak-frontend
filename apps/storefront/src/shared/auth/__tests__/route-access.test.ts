import { describe, expect, it } from "vitest"

import { isWithinShop, parseShopPath, routeDecision } from "../route-access"
import { hostTenant, pathTenant, NO_TENANT } from "@/shared/lib/tenant"

/**
 * The guard no longer parses the shop out of the path — `proxy.ts` resolves it
 * and hands it down. These helpers put the two addresses side by side so every
 * rule below can be asserted on both:
 *
 *   onPath("/acme/checkout")   zaydak.com/acme/checkout
 *   onHost("acme", "/checkout")   acme.zaydak.com/checkout
 */
/**
 * `/\evil.example` — the backslash form, which a browser reads as
 * protocol-relative exactly like `//evil.example`.
 *
 * Built from a char code rather than written as a literal on purpose. In a
 * TS string `"\e"` is not an escape sequence and collapses to `"e"`, so a
 * single-backslash literal here silently asserts about `/evil.example` and
 * the case this test is named for goes uncovered.
 */
const BACKSLASH_ABSOLUTE = `/${String.fromCharCode(92)}evil.example`

const scopeOf = (pathname: string) => {
  const slug = parseShopPath(pathname).shopSlug
  return slug ? pathTenant(slug) : NO_TENANT
}

type Rest = Omit<Parameters<typeof routeDecision>[0], "pathname" | "shopSlug" | "base">

const onPath = (pathname: string, rest: Rest) => {
  const { slug, base } = scopeOf(pathname)
  return routeDecision({ pathname, shopSlug: slug, base, ...rest })
}

const onHost = (slug: string, pathname: string, rest: Rest) => {
  const t = hostTenant(slug)
  return routeDecision({ pathname, shopSlug: t.slug, base: t.base, ...rest })
}

/**
 * The guard is inverted relative to the consoles' — public by default, with a
 * short private list — so the cases that matter most are the ones asserting
 * that browsing is *never* gated.
 */
describe("parseShopPath", () => {
  it("splits the shop slug from the section", () => {
    expect(parseShopPath("/acme/products/blue-mug")).toEqual({
      shopSlug: "acme",
      section: "products",
    })
  })

  it("gives the shop home an empty section", () => {
    expect(parseShopPath("/acme")).toEqual({ shopSlug: "acme", section: "" })
  })

  it("reports no shop for the root", () => {
    expect(parseShopPath("/")).toEqual({ shopSlug: null, section: "" })
  })

  it("ignores a trailing slash", () => {
    expect(parseShopPath("/acme/cart/")).toEqual({
      shopSlug: "acme",
      section: "cart",
    })
  })
})

describe("routeDecision", () => {
  const anon = { token: undefined, expired: false }
  const signedIn = { token: "header.payload.signature", expired: false }

  it("lets a signed-out visitor browse the directory", () => {
    expect(onPath("/", { ...anon })).toEqual({ type: "next" })
  })

  it("lets a signed-out visitor into a shop", () => {
    expect(onPath("/acme", { ...anon })).toEqual({
      type: "next",
    })
  })

  it("lets a signed-out visitor read a product", () => {
    expect(
      onPath("/acme/products/blue-mug", { ...anon }),
    ).toEqual({ type: "next" })
  })

  it("lets a signed-out visitor use the cart", () => {
    // The anonymous cart is the whole reason `cart` is not in PRIVATE_SEGMENTS.
    expect(onPath("/acme/cart", { ...anon })).toEqual({
      type: "next",
    })
  })

  it("sends a signed-out visitor from checkout to sign-in, keeping the way back", () => {
    expect(onPath("/acme/checkout", { ...anon })).toEqual({
      type: "redirect",
      to: "/acme/login?redirect=%2Facme%2Fcheckout",
      clearCookies: false,
    })
  })

  it("gates the account area", () => {
    for (const pathname of ["/acme/account", "/acme/account/orders"]) {
      expect(onPath(pathname, anon)).toMatchObject({
        type: "redirect",
      })
    }
  })

  it("leaves the wishlist open, like the cart", () => {
    // Both are lists a visitor builds before they have an account — the heart
    // saves signed-out into localStorage and the sign-in hands it over. Gating
    // the page would let somebody save items and then refuse to show them.
    for (const pathname of ["/acme/wishlist", "/acme/cart"]) {
      expect(onPath(pathname, anon)).toEqual({ type: "next" })
    }
  })

  it("keeps a signed-in visitor off the sign-in screen", () => {
    expect(onPath("/acme/login", { ...signedIn })).toEqual({
      type: "redirect",
      to: "/acme/account",
      clearCookies: false,
    })
  })

  it("does not gate any browse route for a signed-in visitor", () => {
    expect(onPath("/acme/products", { ...signedIn })).toEqual({
      type: "next",
    })
  })

  it("admits a vendor's token — anyone may shop", () => {
    // The admin console refuses a non-admin token. A storefront must not: the
    // back-end's createOrder has no role check, so a vendor buying elsewhere is
    // an ordinary customer.
    expect(onPath("/acme/checkout", { ...signedIn })).toEqual({
      type: "next",
    })
  })

  it("clears the jar and bounces to this shop's sign-in when the token expired", () => {
    expect(
      onPath("/acme/account", {
        token: "stale",
        expired: true,
      }),
    ).toEqual({
      type: "redirect",
      to: "/acme/login?expired=1",
      clearCookies: true,
    })
  })

  it("clears without redirecting when the expired visitor is already at sign-in", () => {
    // Redirecting here would bounce /login to /login forever.
    expect(
      onPath("/acme/login", { token: "stale", expired: true }),
    ).toEqual({ type: "clear" })
  })

  it("builds the redirect from the shop in the URL, not a fixed path", () => {
    const decision = onPath("/other-shop/checkout", { ...anon })
    expect(decision).toMatchObject({ to: expect.stringContaining("/other-shop/login") })
  })
})

/**
 * Per-shop sessions, from the guard's side.
 *
 * The guard never learns "signed in at another shop" — it is handed the cookie
 * named for the shop in the path, and its absence is the whole mechanism. These
 * pin that the collapse is deliberate rather than an oversight.
 */
describe("routeDecision — a session belongs to one shop", () => {
  it("gates a private route when this shop has no token, whatever other shops hold", () => {
    expect(
      onPath("/beta/checkout", {
        token: undefined,
        expired: false,
      }),
    ).toEqual({
      type: "redirect",
      to: "/beta/login?redirect=%2Fbeta%2Fcheckout",
      clearCookies: false,
    })
  })

  it("serves a private route when this shop does hold a token", () => {
    expect(
      onPath("/acme/checkout", {
        token: "acme-token",
        expired: false,
      }),
    ).toEqual({ type: "next" })
  })

  it("still bounces a signed-in visitor off this shop's login screen", () => {
    expect(
      onPath("/acme/login", {
        token: "acme-token",
        expired: false,
      }),
    ).toEqual({ type: "redirect", to: "/acme/account", clearCookies: false })
  })

  it("honours ?redirect when bouncing off login, rather than dropping them on the account hub", () => {
    expect(
      onPath("/acme/login", {
        token: "acme-token",
        expired: false,
        redirect: "/acme/checkout",
      }),
    ).toEqual({ type: "redirect", to: "/acme/checkout", clearCookies: false })
  })

  it("refuses a ?redirect naming another shop", () => {
    expect(
      onPath("/acme/login", {
        token: "acme-token",
        expired: false,
        redirect: "/beta/checkout",
      }),
    ).toEqual({ type: "redirect", to: "/acme/account", clearCookies: false })
  })

  it("refuses a protocol-relative ?redirect", () => {
    expect(
      onPath("/acme/login", {
        token: "acme-token",
        expired: false,
        redirect: "//evil.example/acme",
      }),
    ).toEqual({ type: "redirect", to: "/acme/account", clearCookies: false })
  })
})

describe("isWithinShop", () => {
  it("accepts a path inside the shop", () => {
    expect(isWithinShop("/acme/checkout", "/acme")).toBe(true)
  })

  it("accepts a path with a query string", () => {
    expect(isWithinShop("/acme/products?page=2", "/acme")).toBe(true)
  })

  it("rejects another shop", () => {
    expect(isWithinShop("/beta/checkout", "/acme")).toBe(false)
  })

  // Both start with "/" and are absolute to a browser.
  it("rejects protocol-relative and backslash forms", () => {
    expect(isWithinShop("//evil.example", "/acme")).toBe(false)
    expect(isWithinShop(BACKSLASH_ABSOLUTE, "/acme")).toBe(false)
  })

  it("rejects an absolute URL and an empty value", () => {
    expect(isWithinShop("https://evil.example/acme", "/acme")).toBe(false)
    expect(isWithinShop(null, "/acme")).toBe(false)
    expect(isWithinShop("", "/acme")).toBe(false)
  })
})

/**
 * The same rules, on a shop's own hostname.
 *
 * This is the block that would have caught the silent failure. On
 * `acme.zaydak.com/checkout` the first path segment is `checkout`, so a guard
 * that parses the shop out of the path concludes the shop is "checkout", the
 * section is empty, and the page is the shop home — public. Checkout would have
 * stopped being gated with no test failing anywhere.
 */
describe("routeDecision — on the shop's own hostname", () => {
  const anon = { token: undefined, expired: false }
  const signedIn = { token: "header.payload.signature", expired: false }

  it("gates checkout, and the way back carries no slug segment", () => {
    expect(onHost("acme", "/checkout", anon)).toEqual({
      type: "redirect",
      to: "/login?redirect=%2Fcheckout",
      clearCookies: false,
    })
  })

  it("gates the account area", () => {
    for (const pathname of ["/account", "/account/orders"]) {
      expect(onHost("acme", pathname, anon)).toMatchObject({
        type: "redirect",
        to: expect.stringContaining("/login"),
      })
    }
  })

  it("leaves browsing, the cart and the wishlist open", () => {
    for (const pathname of ["/", "/products", "/products/blue-mug", "/cart", "/wishlist"]) {
      expect(onHost("acme", pathname, anon)).toEqual({ type: "next" })
    }
  })

  it("keeps a signed-in visitor off the sign-in screen", () => {
    expect(onHost("acme", "/login", signedIn)).toEqual({
      type: "redirect",
      to: "/account",
      clearCookies: false,
    })
  })

  it("clears the jar and bounces to sign-in when the token expired", () => {
    expect(
      onHost("acme", "/account", { token: "stale", expired: true }),
    ).toEqual({
      type: "redirect",
      to: "/login?expired=1",
      clearCookies: true,
    })
  })

  it("clears without redirecting when the expired visitor is already at sign-in", () => {
    expect(onHost("acme", "/login", { token: "stale", expired: true })).toEqual({
      type: "clear",
    })
  })

  it("honours a ?redirect written in this host's vocabulary", () => {
    expect(
      onHost("acme", "/login", { ...signedIn, redirect: "/checkout" }),
    ).toEqual({ type: "redirect", to: "/checkout", clearCookies: false })
  })

  it("still refuses a protocol-relative ?redirect", () => {
    // The one open-redirect check that cannot be relaxed by an empty `base`.
    expect(
      onHost("acme", "/login", { ...signedIn, redirect: "//evil.example" }),
    ).toEqual({ type: "redirect", to: "/account", clearCookies: false })
    expect(
      onHost("acme", "/login", { ...signedIn, redirect: "https://evil.example/" }),
    ).toEqual({ type: "redirect", to: "/account", clearCookies: false })
  })

  it("does not mistake a section for a shop", () => {
    // The same paths that name a shop on the apex name a section here, and the
    // guard must reach the opposite verdict on each.
    expect(onPath("/checkout", anon)).toEqual({ type: "next" })
    expect(onHost("acme", "/checkout", anon)).toMatchObject({ type: "redirect" })
  })
})

describe("isWithinShop — on the shop's own hostname", () => {
  it("accepts any same-origin path, because the host is the scope", () => {
    expect(isWithinShop("/checkout", "")).toBe(true)
    expect(isWithinShop("/products?page=2", "")).toBe(true)
    expect(isWithinShop("/", "")).toBe(true)
  })

  it("still refuses everything that is absolute to a browser", () => {
    expect(isWithinShop("//evil.example", "")).toBe(false)
    expect(isWithinShop(BACKSLASH_ABSOLUTE, "")).toBe(false)
    expect(isWithinShop("https://evil.example/x", "")).toBe(false)
    expect(isWithinShop(null, "")).toBe(false)
    expect(isWithinShop("", "")).toBe(false)
  })

  it("does not accept a sibling shop that merely shares a prefix", () => {
    expect(isWithinShop("/acme-two/checkout", "/acme")).toBe(false)
    expect(isWithinShop("/acme", "/acme")).toBe(true)
  })
})
