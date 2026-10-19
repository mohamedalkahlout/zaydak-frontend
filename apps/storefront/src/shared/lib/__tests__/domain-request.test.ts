import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  domainCacheSize,
  forgetDomainRequest,
  MAX_ENTRIES,
  MISS_TTL_MS,
  resolveDomainRequest,
  SERVE_TTL_MS,
  worthResolving,
} from "../domain-request"

/**
 * The cache and the guard in front of the serve-or-redirect verdict.
 *
 * The verdict itself is the back-end's (`ShopDomainsService.resolveDomainRequest`)
 * and is tested there. What matters here is everything this module does *around*
 * it: which hostnames are worth asking about at all, how long an answer is kept,
 * and — the part with teeth — what it refuses to pass through to a caller that
 * is about to issue a redirect from it.
 */

const ok = (data: unknown) =>
  ({
    ok: true,
    json: () => Promise.resolve({ data: { domainRequest: { data } } }),
  }) as unknown as Response

describe("domain-request", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    forgetDomainRequest()
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe("worthResolving", () => {
    it("asks about a platform subdomain", () => {
      // The change from the lookup this replaced. It has a tenant already —
      // read from the host string — but whether the shop still uses that
      // address is exactly the question.
      expect(worthResolving("acme.localhost")).toBe(false)
      expect(worthResolving("acme.example.com")).toBe(true)
    })

    it("asks about a merchant's own domain", () => {
      expect(worthResolving("nikestore.com")).toBe(true)
    })

    it.each(["localhost", "dev.localhost", "127.0.0.1", "[::1]", "nodots", ""])(
      "never asks about %j",
      (host) => {
        expect(worthResolving(host)).toBe(false)
      },
    )
  })

  describe("resolving", () => {
    it("returns the verdict the back-end gave", async () => {
      fetchMock.mockResolvedValue(
        ok({
          slug: "nike",
          role: "PLATFORM",
          action: "REDIRECT",
          primary_hostname: "nikestore.com",
        }),
      )

      expect(await resolveDomainRequest("nike.zaydak.com")).toEqual({
        slug: "nike",
        role: "PLATFORM",
        action: "REDIRECT",
        primaryHostname: "nikestore.com",
      })
    })

    it("caches, so a hot hostname crosses the network once", async () => {
      fetchMock.mockResolvedValue(
        ok({ slug: "nike", role: "PRIMARY", action: "SERVE" }),
      )

      await resolveDomainRequest("nike.zaydak.com")
      await resolveDomainRequest("nike.zaydak.com")

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("never caches a redirect", async () => {
      // The property that makes a loop impossible rather than rare. Two stale
      // answers pointing at each other is the only way a loop can arise, and a
      // loop shows the visitor a blank page rather than a wrong one.
      fetchMock.mockResolvedValue(
        ok({
          slug: "nike",
          role: "PLATFORM",
          action: "REDIRECT",
          primary_hostname: "nikestore.com",
        }),
      )

      await resolveDomainRequest("nike.zaydak.com")
      await resolveDomainRequest("nike.zaydak.com")

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("caches a miss too", async () => {
      // Every bot probing a random Host header arrives here. Caching only hits
      // would query for each of them on every request forever.
      fetchMock.mockResolvedValue(ok(null))

      await resolveDomainRequest("nothing.example")
      await resolveDomainRequest("nothing.example")

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("never asks about a host that cannot belong to a shop", async () => {
      expect(await resolveDomainRequest("localhost")).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // ─── the TTL is the whole invalidation story, so it is pinned as one ────────

  describe("how long an answer is kept", () => {
    // Nothing can reach this map — no key for the back-end to clear, no
    // broadcast, no list of warm instances — so the TTL is not a performance
    // knob, it is the ceiling on how long a merchant's change can fail to show
    // up here. These pin the ceiling at the two numbers the module exports.
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it("re-asks once a SERVE verdict is older than its bound", async () => {
      fetchMock.mockResolvedValue(
        ok({ slug: "nike", role: "PRIMARY", action: "SERVE" }),
      )

      await resolveDomainRequest("nikestore.com")
      vi.advanceTimersByTime(SERVE_TTL_MS - 1)
      await resolveDomainRequest("nikestore.com")
      expect(fetchMock).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2)
      await resolveDomainRequest("nikestore.com")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("gives a miss a shorter life than a hit", async () => {
      // A merchant who has just finished DNS setup must not be told their
      // domain does not exist for a full minute afterwards — to them that
      // reads as the verification having failed.
      expect(MISS_TTL_MS).toBeLessThan(SERVE_TTL_MS)

      fetchMock.mockResolvedValue(ok(null))

      await resolveDomainRequest("nothing.example")
      vi.advanceTimersByTime(MISS_TTL_MS - 1)
      await resolveDomainRequest("nothing.example")
      expect(fetchMock).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2)
      await resolveDomainRequest("nothing.example")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("keeps a failure on the miss clock, not the serve clock", async () => {
      // An outage must not put a 2.5s timeout in front of every custom-domain
      // request for as long as the API is down, and must not keep a shop off
      // its own domain once the API is back.
      fetchMock.mockRejectedValue(new Error("ETIMEDOUT"))

      await resolveDomainRequest("nikestore.com")
      vi.advanceTimersByTime(MISS_TTL_MS - 1)
      await resolveDomainRequest("nikestore.com")
      expect(fetchMock).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2)
      await resolveDomainRequest("nikestore.com")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  // ─── the keys are attacker-chosen, so the map has to have a ceiling ─────────

  describe("staying bounded", () => {
    it("never grows past MAX_ENTRIES, whatever arrives in a Host header", async () => {
      // `worthResolving` lets through every string with a dot in it, because
      // that is exactly the shape a real custom domain has. One sweep of
      // generated hostnames would otherwise grow this map for the life of the
      // process.
      fetchMock.mockResolvedValue(ok(null))

      for (let i = 0; i < MAX_ENTRIES + 50; i += 1) {
        await resolveDomainRequest(`probe-${i}.example`)
      }

      expect(domainCacheSize()).toBeLessThanOrEqual(MAX_ENTRIES)
    })

    it("drops the oldest entry rather than the newest", async () => {
      fetchMock.mockResolvedValue(ok(null))

      await resolveDomainRequest("first.example")
      for (let i = 0; i < MAX_ENTRIES; i += 1) {
        await resolveDomainRequest(`probe-${i}.example`)
      }

      const before = fetchMock.mock.calls.length
      await resolveDomainRequest("first.example")
      expect(fetchMock.mock.calls.length).toBe(before + 1)

      // ...while the most recent probe is still remembered, so it costs
      // nothing.
      await resolveDomainRequest(`probe-${MAX_ENTRIES - 1}.example`)
      expect(fetchMock.mock.calls.length).toBe(before + 1)
    })

    it("does not let a redirect take a seat at all", async () => {
      // The other half of "never cached": not merely re-fetched, but never
      // stored — so a stream of redirecting hostnames cannot evict the real
      // working set either.
      fetchMock.mockResolvedValue(
        ok({
          slug: "nike",
          role: "PLATFORM",
          action: "REDIRECT",
          primary_hostname: "nikestore.com",
        }),
      )

      await resolveDomainRequest("nike.zaydak.com")
      await resolveDomainRequest("old.zaydak.com")

      expect(domainCacheSize()).toBe(0)
    })
  })

  describe("degrading rather than failing", () => {
    it.each([
      ["a network failure", () => Promise.reject(new Error("ETIMEDOUT"))],
      ["a non-200 answer", () => Promise.resolve({ ok: false } as Response)],
      [
        "a body that is not a verdict",
        () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ nonsense: true }),
          } as unknown as Response),
      ],
    ])("returns null on %s", async (_label, impl) => {
      // This runs ahead of every page. An API blip has to degrade to "serve
      // whatever the host resolved to" — the behaviour before redirects
      // existed — not take down every request on the storefront.
      fetchMock.mockImplementation(impl)
      expect(await resolveDomainRequest("nikestore.com")).toBeNull()
    })
  })

  // ─── what must never reach a caller about to issue a redirect ───────────────

  describe("refusing a verdict that would loop", () => {
    it("drops a redirect pointing at the host we are already on", async () => {
      // Third line of defence, after the back-end's structural guarantee and
      // the proxy's own check. It earns its place by what it prevents: every
      // other bug here shows a wrong page, this one shows nothing at all.
      fetchMock.mockResolvedValue(
        ok({
          slug: "nike",
          role: "PRIMARY",
          action: "REDIRECT",
          primary_hostname: "nikestore.com",
        }),
      )

      const verdict = await resolveDomainRequest("nikestore.com")
      expect(verdict).toMatchObject({ action: "SERVE" })
      expect(verdict?.primaryHostname).toBeUndefined()
    })

    it("drops a redirect with no destination", async () => {
      fetchMock.mockResolvedValue(
        ok({ slug: "nike", role: "ALIAS", action: "REDIRECT" }),
      )
      expect(await resolveDomainRequest("www.nikestore.com")).toMatchObject({
        action: "SERVE",
      })
    })

    it("matches the destination case-insensitively", async () => {
      fetchMock.mockResolvedValue(
        ok({
          slug: "nike",
          role: "PRIMARY",
          action: "REDIRECT",
          primary_hostname: "NikeStore.COM",
        }),
      )
      expect(await resolveDomainRequest("nikestore.com")).toMatchObject({
        action: "SERVE",
      })
    })

    it("rejects a verdict carrying no slug", async () => {
      // A slug is what goes out as `X-SHOP`. An empty one would scope every
      // query on the page to a shop that does not exist.
      fetchMock.mockResolvedValue(ok({ role: "PRIMARY", action: "SERVE" }))
      expect(await resolveDomainRequest("nikestore.com")).toBeNull()
    })

    it("falls back to PRIMARY for a role it does not recognise", async () => {
      fetchMock.mockResolvedValue(
        ok({ slug: "nike", role: "SOMETHING_NEW", action: "SERVE" }),
      )
      expect(await resolveDomainRequest("nikestore.com")).toMatchObject({
        role: "PRIMARY",
      })
    })
  })
})
