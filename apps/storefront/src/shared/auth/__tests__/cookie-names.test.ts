import { describe, expect, it } from "vitest"

import {
  MAX_SHOP_SESSIONS,
  SESSION_COOKIE_RE,
  SESSION_INDEX_COOKIE,
  CART_SESSION_COOKIE,
  LEGACY_SESSION_COOKIES,
  accessCookie,
  refreshCookie,
  sessionCookieNames,
  shopCookieKey,
} from "../cookie-names"

/**
 * The cookie name is what makes a session belong to one storefront on the
 * client. It is not the security boundary — that is the `shop_id` claim the
 * back-end checks — but a collision or a rejected slug here is a shop nobody
 * can sign into, so the derivation is pinned.
 */
describe("shopCookieKey", () => {
  it("uses an ordinary slug verbatim, so devtools stays readable", () => {
    expect(shopCookieKey("acme")).toBe("acme")
    expect(shopCookieKey("acme-store-2")).toBe("acme-store-2")
  })

  // Shop slugs are derived server-side by `slugify(name)` and never
  // re-validated, and `slugify` yields "" for a name with no Latin characters.
  // Rejecting would mean credentials accepted, a refresh row written, and then
  // the cookie write failing — a shop permanently unable to sign anyone in.
  it("derives a key rather than rejecting an unusual slug", () => {
    for (const slug of ["", "-1", "Ünïcødé", "a b", "a;b", "a=b", "a/b"]) {
      const key = shopCookieKey(slug)
      expect(key.startsWith(".")).toBe(true)
      expect(key).not.toContain(" ")
      expect(key).not.toMatch(/[=;,()<>@:\\"/[\]?{}]/)
    }
  })

  it("is stable for the same slug", () => {
    expect(shopCookieKey("東京ストア")).toBe(shopCookieKey("東京ストア"))
  })

  it("separates different slugs", () => {
    expect(shopCookieKey("a b")).not.toBe(shopCookieKey("a;b"))
  })

  // The dot prefix marks the derived form, and an ordinary slug can never
  // contain one — so a hash cannot collide with a literal slug.
  it("cannot collide with a literal slug", () => {
    const derived = shopCookieKey("a b")
    expect(shopCookieKey(derived)).not.toBe(derived)
  })

  it("derives a key for an over-long slug", () => {
    expect(shopCookieKey("a".repeat(65)).startsWith(".")).toBe(true)
  })
})

describe("session cookie names", () => {
  it("gives two shops four distinct names each", () => {
    const acme = sessionCookieNames("acme")
    const beta = sessionCookieNames("beta")
    expect(acme).toHaveLength(4)
    expect(new Set([...acme, ...beta]).size).toBe(8)
  })

  it("keeps the shop_ prefix that separates this app from the consoles", () => {
    for (const name of sessionCookieNames("acme")) {
      expect(name.startsWith("shop_")).toBe(true)
    }
  })
})

/**
 * The sweep regex decides what "sign out of every shop" deletes. Matching one
 * cookie too many would take the anonymous cart or the index with it.
 */
describe("SESSION_COOKIE_RE", () => {
  it("matches every per-shop session cookie", () => {
    for (const slug of ["acme", "a b"]) {
      for (const name of sessionCookieNames(slug)) {
        expect(SESSION_COOKIE_RE.test(name)).toBe(true)
      }
    }
  })

  it("does not match the cart, the index, or an unrelated cookie", () => {
    expect(SESSION_COOKIE_RE.test(CART_SESSION_COOKIE)).toBe(false)
    expect(SESSION_COOKIE_RE.test(SESSION_INDEX_COOKIE)).toBe(false)
    expect(SESSION_COOKIE_RE.test("admin_access_token")).toBe(false)
  })

  // The legacy names have no key segment before the suffix. They are deleted
  // deliberately by name, never adopted as credentials — a token minted before
  // the back-end shipped its half carries no shop claim.
  it("does not match the legacy flat names", () => {
    for (const name of LEGACY_SESSION_COOKIES) {
      expect(SESSION_COOKIE_RE.test(name)).toBe(false)
    }
  })
})

describe("the session cap", () => {
  it("keeps four shops well inside the 16 KB request-header ceiling", () => {
    // ~770 bytes per shop: a ~530-byte access JWT, a 64-hex refresh token, two
    // ISO timestamps, plus the names. The jar is shared with the vendor and
    // admin apps under one apex domain, so the margin is the point.
    const perShop =
      sessionCookieNames("a-typical-shop-slug").join("").length + 700
    expect(MAX_SHOP_SESSIONS * perShop).toBeLessThan(4096)
  })

  it("names the access and refresh cookies distinctly for one shop", () => {
    expect(accessCookie("acme")).not.toBe(refreshCookie("acme"))
  })
})
