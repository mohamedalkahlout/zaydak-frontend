import { describe, expect, it } from "vitest"

import {
  hostPort,
  normalizeHostname,
  resolveHostScope,
  shopOrigin,
} from "../hostname"

const ROOT = "zaydak.com"

describe("normalizeHostname", () => {
  it("lowercases", () => {
    expect(normalizeHostname("NIKE.ZAYDAK.COM")).toBe("nike.zaydak.com")
  })

  it("removes the port", () => {
    expect(normalizeHostname("zaydak.com:443")).toBe("zaydak.com")
    expect(normalizeHostname("nike.localhost:3003")).toBe("nike.localhost")
  })

  it("removes a single trailing dot", () => {
    // The fully-qualified form of the same name. Some clients send it, and a
    // tenant lookup that treated it as a different host would 404 at random.
      expect(normalizeHostname(`nike.zaydak.com${String.fromCharCode(13)}`)).toBe(
        "nike.zaydak.com",
      )
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeHostname("  zaydak.com  ")).toBe("zaydak.com")
  })

  it("keeps a bare hostname unchanged", () => {
    expect(normalizeHostname("localhost")).toBe("localhost")
    expect(normalizeHostname("zaydak.com")).toBe("zaydak.com")
  })

  it("keeps an IPv4 literal, which is a legal Host", () => {
    expect(normalizeHostname("127.0.0.1:3003")).toBe("127.0.0.1")
  })

  it("keeps a bracketed IPv6 literal", () => {
    expect(normalizeHostname("[::1]")).toBe("[::1]")
    expect(normalizeHostname("[::1]:3003")).toBe("[::1]")
  })

  describe("rejects, rather than guessing", () => {
    it.each([
      ["", "empty"],
      ["   ", "whitespace only"],
      ["zaydak.com/path", "a path"],
      ["https://zaydak.com", "a scheme"],
      ["user@zaydak.com", "userinfo"],
      ["zaydak.com?x=1", "a query"],
      ["zaydak.com#frag", "a fragment"],
      ["zay dak.com", "an inner space"],
      ["zaydak.com:notaport", "a non-numeric port"],
      ["zaydak.com:1234567", "an oversized port"],
      ["nike..zaydak.com", "an empty label"],
      [".zaydak.com", "a leading dot"],
      ["nike.zaydak.com..", "two trailing dots"],
      ["-nike.zaydak.com", "a label starting with a hyphen"],
      ["nike-.zaydak.com", "a label ending with a hyphen"],
      ["ni_ke.zaydak.com", "an underscore"],
      ["[::1", "an unclosed bracket"],
      ["[::1]x", "junk after the bracket"],
    ])("refuses %j (%s)", (input) => {
      expect(normalizeHostname(input)).toBeNull()
    })

    it("refuses an embedded control character", () => {
      // Trailing whitespace, CR included, is trimmed rather than refused —
      // that is normalisation, not a malformed host. What must never survive
      // is a control character INSIDE the name, which is how a header gets
      // read as two different hosts by two different parsers.
      expect(normalizeHostname(`nike${String.fromCharCode(0)}.zaydak.com`)).toBeNull()
      expect(normalizeHostname(`nike${String.fromCharCode(1)}.zaydak.com`)).toBeNull()
      expect(normalizeHostname(`nike.zaydak${String.fromCharCode(127)}.com`)).toBeNull()
      expect(
        normalizeHostname(`nike.zaydak.com${String.fromCharCode(13)}`),
      ).toBe("nike.zaydak.com")
    })

    it("refuses a label over 63 octets and a host over 253", () => {
      expect(normalizeHostname(`${"a".repeat(64)}.zaydak.com`)).toBeNull()
      const long = `${Array.from({ length: 10 }, () => "a".repeat(30)).join(".")}.com`
      expect(long.length).toBeGreaterThan(253)
      expect(normalizeHostname(long)).toBeNull()
    })

    it("refuses nullish input", () => {
      expect(normalizeHostname(null)).toBeNull()
      expect(normalizeHostname(undefined)).toBeNull()
    })
  })
})

describe("resolveHostScope", () => {
  it("reads a merchant subdomain as a shop handle", () => {
    expect(resolveHostScope("nike.zaydak.com", ROOT)).toEqual({
      kind: "tenant",
      slug: "nike",
    })
    expect(resolveHostScope("fashion.zaydak.com", ROOT)).toEqual({
      kind: "tenant",
      slug: "fashion",
    })
  })

  it("reads demo and test as shops, not environments", () => {
    // Both are the product's own worked examples. Reserving them would make
    // the documented URLs 404.
    expect(resolveHostScope("demo.zaydak.com", ROOT)).toEqual({
      kind: "tenant",
      slug: "demo",
    })
    expect(resolveHostScope("test.zaydak.com", ROOT)).toEqual({
      kind: "tenant",
      slug: "test",
    })
  })

  it("normalises before classifying", () => {
    expect(resolveHostScope("DEMO.ZAYDAK.COM", ROOT)).toEqual({
      kind: "tenant",
      slug: "demo",
    })
    expect(resolveHostScope("DEMO.ZAYDAK.COM.:443", ROOT)).toEqual({
      kind: "tenant",
      slug: "demo",
    })
  })

  it("treats a hyphenated handle as one label", () => {
    expect(resolveHostScope("blue-mug-co.zaydak.com", ROOT)).toEqual({
      kind: "tenant",
      slug: "blue-mug-co",
    })
  })

  it("treats the apex itself as the marketplace", () => {
    expect(resolveHostScope("zaydak.com", ROOT)).toEqual({ kind: "apex" })
  })

  it("never resolves a reserved label as a merchant", () => {
    for (const label of ["www", "admin", "dash", "api", "mail", "login"]) {
      expect(resolveHostScope(`${label}.zaydak.com`, ROOT)).toEqual({
        kind: "reserved",
        label,
      })
    }
  })

  it("refuses more than one label under the apex", () => {
    // DNS wildcards one level, so `a.b.<root>` was never provisioned and
    // reading `a.b` as a handle would send an X-SHOP nothing can match.
    expect(resolveHostScope("a.b.zaydak.com", ROOT)).toEqual({ kind: "apex" })
  })

  it("refuses a suffix that merely appears in the host", () => {
    expect(resolveHostScope("zaydak.com.evil.test", ROOT)).toEqual({
      kind: "apex",
    })
    expect(resolveHostScope("evilzaydak.com", ROOT)).toEqual({ kind: "apex" })
  })

  it("falls back to the apex for a host outside the root domain", () => {
    // This is what keeps every existing URL working: a Vercel deployment URL
    // and a preview build are not tenants, so the path still names the shop.
    expect(resolveHostScope("zaydak.vercel.app", ROOT)).toEqual({ kind: "apex" })
    expect(resolveHostScope("zaydak-git-main.vercel.app", ROOT)).toEqual({
      kind: "apex",
    })
    expect(resolveHostScope("127.0.0.1", ROOT)).toEqual({ kind: "apex" })
  })

  it("falls back to the apex for an unreadable host", () => {
    expect(resolveHostScope("not a host", ROOT)).toEqual({ kind: "apex" })
    expect(resolveHostScope(null, ROOT)).toEqual({ kind: "apex" })
    expect(resolveHostScope("", ROOT)).toEqual({ kind: "apex" })
  })

  it("disables host mode entirely when there is no root domain", () => {
    // The deployment that forgot the env var behaves exactly as it did before
    // the feature existed, rather than serving one merchant to everyone.
    expect(resolveHostScope("nike.zaydak.com", null)).toEqual({ kind: "apex" })
  })

  describe("local development", () => {
    it("resolves a *.localhost tenant", () => {
      expect(resolveHostScope("demo.localhost:3003", "localhost")).toEqual({
        kind: "tenant",
        slug: "demo",
      })
      expect(resolveHostScope("shop1.localhost:3003", "localhost")).toEqual({
        kind: "tenant",
        slug: "shop1",
      })
    })

    it("treats bare localhost as the marketplace", () => {
      expect(resolveHostScope("localhost:3003", "localhost")).toEqual({
        kind: "apex",
      })
    })
  })
})

describe("hostPort", () => {
  it("extracts a port when present", () => {
    expect(hostPort("demo.localhost:3003")).toBe("3003")
  })

  it("returns null when there is none", () => {
    expect(hostPort("zaydak.com")).toBeNull()
    expect(hostPort(null)).toBeNull()
  })
})

describe("shopOrigin", () => {
  it("builds an https origin under a real apex", () => {
    expect(shopOrigin("nike", ROOT)).toBe("https://nike.zaydak.com")
  })

  it("builds an http origin under localhost and carries the port", () => {
    expect(shopOrigin("demo", "localhost", "3003")).toBe(
      "http://demo.localhost:3003",
    )
  })

  it("returns null with no apex configured, so callers fall back to the path form", () => {
    expect(shopOrigin("nike", null)).toBeNull()
  })

  it("returns null for a handle that is not a legal label", () => {
    expect(shopOrigin("not a slug", ROOT)).toBeNull()
    expect(shopOrigin("", ROOT)).toBeNull()
  })
})
