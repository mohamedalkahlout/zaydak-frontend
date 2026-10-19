import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * The push half of the shop-shell cache.
 *
 * `fetchShopShell` tags its fetch `shop:<slug>` and revalidates on the hour.
 * The tag was written and nothing ever read it, so a vendor publishing a new
 * brand colour watched their own storefront serve the old one for up to sixty
 * minutes. This route is what `updateShop` pings.
 *
 * Most of what is pinned here is about **refusing**: an open cache-purge URL is
 * a free way to make every request miss and hit the API, with no credentials
 * and no rate limit in front of it.
 */

const revalidateTag = vi.hoisted(() => vi.fn())
vi.mock("next/cache", () => ({ revalidateTag }))

const { POST } = await import("../route")

const SECRET = "s3cret-value"

function post(body: unknown, secret?: string): Promise<Response> {
  return POST(
    new Request("https://acme.zaydak.com/api/revalidate-shop", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-revalidate-secret": secret } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.REVALIDATE_SECRET = SECRET
})

afterEach(() => {
  delete process.env.REVALIDATE_SECRET
})

describe("POST /api/revalidate-shop", () => {
  it("purges the tag the shop shell is cached under", async () => {
    const res = await post({ slugs: ["acme"] }, SECRET)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ revalidated: 1 })
    expect(revalidateTag).toHaveBeenCalledWith("shop:acme", "max")
  })

  it("purges both handles of a rename in one call", async () => {
    // The old handle keeps resolving through `shop_slug_history`, so its entry
    // would go on serving the shop's previous identity at an address that
    // still works.
    await post({ slugs: ["old-handle", "new-handle"] }, SECRET)

    expect(revalidateTag).toHaveBeenCalledWith("shop:old-handle", "max")
    expect(revalidateTag).toHaveBeenCalledWith("shop:new-handle", "max")
  })

  it("refuses a request with no secret", async () => {
    const res = await post({ slugs: ["acme"] })

    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("refuses a wrong secret, including one that is merely a prefix", async () => {
    // `timingSafeEqual` throws on a length mismatch rather than returning
    // false, which would turn a short guess into a 500 — and a 500 where a 401
    // belongs leaks the secret's length through the status code.
    for (const guess of ["nope", SECRET.slice(0, -1), `${SECRET}x`]) {
      const res = await post({ slugs: ["acme"] }, guess)
      expect(res.status).toBe(401)
    }
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("is off entirely when no secret is configured", async () => {
    // The documented off state, and the state every deployment starts in:
    // refusing is what stops an unconfigured storefront from carrying an
    // unauthenticated cache-purge endpoint.
    delete process.env.REVALIDATE_SECRET

    const res = await post({ slugs: ["acme"] }, SECRET)

    expect(res.status).toBe(404)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("drops anything that is not a shop handle, and keeps the rest", async () => {
    // A handle is a DNS label everywhere else in this app, so the tag can only
    // ever be built from one. `../` and friends never reach `revalidateTag`.
    const res = await post(
      { slugs: ["acme", "../etc", "Acme", "", "shop:other", 7] },
      SECRET,
    )

    expect(await res.json()).toEqual({ revalidated: 1 })
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith("shop:acme", "max")
  })

  it("refuses an empty or oversized list", async () => {
    expect((await post({ slugs: [] }, SECRET)).status).toBe(400)
    expect(
      (await post({ slugs: Array(9).fill("acme") }, SECRET)).status,
    ).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("refuses a body that is not JSON, rather than throwing", async () => {
    const res = await post("not json at all", SECRET)

    expect(res.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("says how many handles it purged, never whether a shop exists", async () => {
    // A tag with no cache entry revalidates silently, so the count reports
    // well-formedness and nothing about which handles are real.
    const res = await post({ slugs: ["no-such-shop"] }, SECRET)

    expect(await res.json()).toEqual({ revalidated: 1 })
  })
})
