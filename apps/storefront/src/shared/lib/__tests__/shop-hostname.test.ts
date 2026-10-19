import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Which address a shop's **emitted** URLs name.
 *
 * `shopUrlBase` answers from the handle alone, and that answer went stale the
 * moment a merchant could promote their own domain: `acme.zaydak.com` still
 * resolves, but it 308s to `acme.com`, so every canonical tag and every sitemap
 * entry pointed at a redirect. A canonical pointing at a redirect points at
 * nothing, and a sitemap of them is one a crawler follows twice.
 *
 * Two properties carry this file. The promoted domain wins once there is one —
 * and **a shop without one emits byte-identically to what it emitted before**,
 * including on a deployment with no apex configured, which must not so much as
 * open a socket.
 */

const ROOT = "zaydak.com"

type Module = typeof import("../shop-hostname")

const ok = (data: unknown) =>
  ({
    ok: true,
    json: () => Promise.resolve({ data: { domainRequest: { data } } }),
  }) as unknown as Response

/** A verdict about `<slug>.<root>` that names a promoted custom domain. */
const promoted = (slug: string, hostname: string) =>
  ok({ slug, action: "REDIRECT", primary_hostname: hostname })

/** A verdict about `<slug>.<root>` saying the subdomain is still the address. */
const unpromoted = (slug: string) => ok({ slug, action: "SERVE" })

describe("shop-hostname", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Load the module against a given apex. `null` means none configured. */
  async function load(rootDomain: string | null): Promise<Module> {
    if (rootDomain) vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", rootDomain)
    vi.resetModules()
    return import("../shop-hostname")
  }

  describe("with no apex configured", () => {
    it("emits exactly the path form it always did, and asks nobody", async () => {
      // The rule this change must not break. `NEXT_PUBLIC_ROOT_DOMAIN` unset is
      // the state of a deployment that never opted in, and its output has to
      // stay byte-identical — there is no second address to prefer, so there is
      // nothing worth a round trip either.
      const { canonicalShopBase, shopPrimaryHostname } = await load(null)

      expect(await canonicalShopBase("acme")).toBe("http://localhost:3003/acme")
      expect(await shopPrimaryHostname("acme")).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("falls back to the site origin when there is no shop", async () => {
      const { canonicalShopBase } = await load(null)
      expect(await canonicalShopBase(null)).toBe("http://localhost:3003")
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe("with an apex configured", () => {
    it("names the promoted domain once a shop has one", async () => {
      fetchMock.mockResolvedValue(promoted("acme", "acme.com"))
      const { canonicalShopBase } = await load(ROOT)

      expect(await canonicalShopBase("acme")).toBe("https://acme.com")
    })

    it("asks about the shop's own platform subdomain", async () => {
      // The verdict is a question about an address, so the address has to be
      // the one this shop would otherwise be published at — asking about
      // anything else answers about a different shop.
      fetchMock.mockResolvedValue(unpromoted("acme"))
      const { shopPrimaryHostname } = await load(ROOT)

      await shopPrimaryHostname("acme")

      const body = JSON.parse(
        (fetchMock.mock.calls[0]![1] as { body: string }).body,
      ) as { variables: { hostname: string } }
      expect(body.variables.hostname).toBe(`acme.${ROOT}`)
    })

    it("keeps the platform subdomain when nothing has been promoted", async () => {
      fetchMock.mockResolvedValue(unpromoted("acme"))
      const { canonicalShopBase } = await load(ROOT)

      expect(await canonicalShopBase("acme")).toBe(`https://acme.${ROOT}`)
    })

    it("ignores an answer about a different shop", async () => {
      // It goes straight into a URL the whole world is told is canonical, so a
      // mismatched answer would move every one of this shop's pages onto
      // somebody else's domain.
      fetchMock.mockResolvedValue(promoted("beta", "beta.com"))
      const { canonicalShopBase } = await load(ROOT)

      expect(await canonicalShopBase("acme")).toBe(`https://acme.${ROOT}`)
    })

    it("ignores a destination that is not a readable hostname", async () => {
      fetchMock.mockResolvedValue(promoted("acme", "not a host/../x"))
      const { canonicalShopBase } = await load(ROOT)

      expect(await canonicalShopBase("acme")).toBe(`https://acme.${ROOT}`)
    })

    it("ignores a destination that is the subdomain it asked about", async () => {
      fetchMock.mockResolvedValue(promoted("acme", `acme.${ROOT}`))
      const { canonicalShopBase } = await load(ROOT)

      expect(await canonicalShopBase("acme")).toBe(`https://acme.${ROOT}`)
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
      ["no shop at that address", () => Promise.resolve(ok(null))],
    ])("keeps the derived address on %s", async (_label, impl) => {
      // This runs inside `generateMetadata`. A share card is never worth taking
      // a product page down for, and the fallback is the string every page
      // emitted before promoted domains existed.
      fetchMock.mockImplementation(impl)
      const { canonicalShopBase } = await load(ROOT)

      expect(await canonicalShopBase("acme")).toBe(`https://acme.${ROOT}`)
    })
  })

  describe("caching", () => {
    it("crosses the network once per shop", async () => {
      // Unlike the proxy's verdict cache, this one DOES hold a redirect target:
      // the answer is printed into a tag, not into a `Location` header, so the
      // loop that makes caching unsafe there cannot exist here.
      fetchMock.mockResolvedValue(promoted("acme", "acme.com"))
      const { canonicalShopBase } = await load(ROOT)

      await canonicalShopBase("acme")
      await canonicalShopBase("acme")
      await canonicalShopBase("acme")

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("re-asks once the answer is older than its bound", async () => {
      vi.useFakeTimers()
      try {
        fetchMock.mockResolvedValue(promoted("acme", "acme.com"))
        const { canonicalShopBase, PRIMARY_HOSTNAME_TTL_MS } = await load(ROOT)

        await canonicalShopBase("acme")
        vi.advanceTimersByTime(PRIMARY_HOSTNAME_TTL_MS - 1)
        await canonicalShopBase("acme")
        expect(fetchMock).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(2)
        await canonicalShopBase("acme")
        expect(fetchMock).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it("stays bounded", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(ok(null)))
      const { shopPrimaryHostname, primaryHostnameCacheSize, MAX_PRIMARY_ENTRIES } =
        await load(ROOT)

      for (let i = 0; i < MAX_PRIMARY_ENTRIES + 20; i += 1) {
        await shopPrimaryHostname(`shop-${i}`)
      }

      expect(primaryHostnameCacheSize()).toBeLessThanOrEqual(
        MAX_PRIMARY_ENTRIES,
      )
    })
  })
})
