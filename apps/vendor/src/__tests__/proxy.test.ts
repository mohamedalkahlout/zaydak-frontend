import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"
import {
  ACCESS_TOKEN_COOKIE,
  ACTIVE_SHOP_KEY,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/lib/auth/cookie-names"

/**
 * Every branch of `src/proxy.ts` as a unit.
 *
 * Notes on the Next response surface the tests assert on:
 * - `NextResponse.next({ request: { headers } })` encodes the mutated request
 *   headers on the response as `x-middleware-request-<key>` with an
 *   `x-middleware-override-headers` list — that is the wire contract the
 *   `store/[shopSlug]/layout.tsx` server read actually sees.
 * - A passthrough response does not re-emit the request's own cookies, so "no
 *   set and no delete happened" reads as `cookies.get(...)` being `undefined`
 *   rather than "still 'acme'".
 * - Shop-scoped branch checks come *after* the auth gate, so exercising them
 *   needs an access token or the request is redirected to login first.
 */

const req = (url: string, cookies: Record<string, string> = {}) => {
  const request = new NextRequest(url)
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value)
  }
  return request
}

const authed = { [ACCESS_TOKEN_COOKIE]: "tok" }

describe("vendor proxy", () => {
  describe("force logout sweep", () => {
    it("deletes all three cookies on an expired/denied public-auth URL", () => {
      const response = proxy(
        req("http://localhost:3001/login?expired=1", {
          [ACCESS_TOKEN_COOKIE]: "tok",
          [REFRESH_TOKEN_COOKIE]: "ref",
          [ACTIVE_SHOP_KEY]: "acme",
        }),
      )
      expect(response.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBe("")
      expect(response.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe("")
      expect(response.cookies.get(ACTIVE_SHOP_KEY)?.value).toBe("")
    })

    it("leaves cookies alone when there is no token to sweep", () => {
      const response = proxy(req("http://localhost:3001/login?denied=1"))
      // No set, no delete — a clean passthrough.
      expect(response.cookies.get(ACCESS_TOKEN_COOKIE)).toBeUndefined()
      expect(response.cookies.get(REFRESH_TOKEN_COOKIE)).toBeUndefined()
      expect(response.cookies.get(ACTIVE_SHOP_KEY)).toBeUndefined()
    })
  })

  describe("auth gating", () => {
    it("redirects an authed user away from auth pages to /store", () => {
      const response = proxy(req("http://localhost:3001/register", authed))
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toBe(
        "http://localhost:3001/store",
      )
    })

    it("redirects an unauthed visitor from a protected page to login", () => {
      const response = proxy(req("http://localhost:3001/store/acme/products"))
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toBe(
        "http://localhost:3001/login?redirect=%2Fstore%2Facme%2Fproducts",
      )
    })
  })

  describe("shop-scoped routes", () => {
    it("injects the pathname header and no-store on a scoped pass", () => {
      const response = proxy(
        req("http://localhost:3001/store/acme/products/mug", authed),
      )
      expect(
        response.headers.get("x-middleware-request-x-vendor-pathname"),
      ).toBe("/store/acme/products/mug")
      expect(response.headers.get("x-middleware-override-headers")).toContain(
        "x-vendor-pathname",
      )
      expect(response.headers.get("Cache-Control")).toContain("no-store")
    })

    it("writes active_shop_slug from a shop-scoped path", () => {
      const response = proxy(
        req("http://localhost:3001/store/acme/products", authed),
      )
      expect(response.cookies.get(ACTIVE_SHOP_KEY)?.value).toBe("acme")
    })

    it("does not rewrite active_shop_slug when it already matches", () => {
      const response = proxy(
        req("http://localhost:3001/plan/acme", {
          ...authed,
          [ACTIVE_SHOP_KEY]: "acme",
        }),
      )
      // A cookie set with the same value would carry a fresh expiry; an absent
      // set is the cleanest signal we do nothing.
      expect(response.cookies.get(ACTIVE_SHOP_KEY)).toBeUndefined()
    })

    it("never writes a static segment as a shop slug", () => {
      const response = proxy(req("http://localhost:3001/store/change-password", authed))
      expect(response.cookies.get(ACTIVE_SHOP_KEY)).toBeUndefined()
    })

    it("keeps the existing active_shop_slug when a static segment is requested", () => {
      const response = proxy(
        req("http://localhost:3001/store/change-password", {
          ...authed,
          [ACTIVE_SHOP_KEY]: "acme",
        }),
      )
      expect(response.cookies.get(ACTIVE_SHOP_KEY)).toBeUndefined()
    })
  })

  describe("passthrough", () => {
    it("passes non-scoped, non-protected paths through untouched", () => {
      const response = proxy(req("http://localhost:3001/_next/static/css/x.css"))
      expect(response.status).toBe(200)
      expect(
        response.headers.get("x-middleware-request-x-vendor-pathname"),
      ).toBeNull()
      expect(response.cookies.get(ACTIVE_SHOP_KEY)).toBeUndefined()
    })
  })
})