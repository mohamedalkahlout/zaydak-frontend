import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { refreshAccessToken } from "../refresh"
import { useAuthStore } from "@/shared/stores/auth"
import { accessCookie, accessExpiresCookie } from "../cookie-names"

describe("refreshAccessToken (storefront)", () => {
  beforeEach(() => {
    useAuthStore.setState({ sessions: {}, hydrated: false, hydratedFor: null })
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim()
      if (name) document.cookie = `${name}=; max-age=0; path=/`
    })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("coalesces concurrent in-flight requests for the same shop", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            access_token: "acme-token",
            access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          },
        }),
      }
    })
    vi.stubGlobal("fetch", fetchMock)

    const [t1, t2, t3] = await Promise.all([
      refreshAccessToken("acme"),
      refreshAccessToken("acme"),
      refreshAccessToken("acme"),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(t1).toBe("acme-token")
    expect(t2).toBe("acme-token")
    expect(t3).toBe("acme-token")
  })

  it("coordinates via navigator.locks and adopts existing session if already refreshed", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const futureExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    document.cookie = `${accessCookie("acme")}=already-refreshed-token; path=/`
    document.cookie = `${accessExpiresCookie("acme")}=${encodeURIComponent(futureExpiry)}; path=/`

    const requestLockMock = vi.fn(async (name: string, cb: () => Promise<string | null>) => {
      return await cb()
    })
    vi.stubGlobal("navigator", {
      locks: {
        request: requestLockMock,
      },
    })

    const token = await refreshAccessToken("acme")

    expect(requestLockMock).toHaveBeenCalledWith("sf_auth_refresh_acme", expect.any(Function))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(token).toBe("already-refreshed-token")
  })

  it("re-hydrates and recovers active token when route responds with TOKEN_ROTATED_RECENTLY", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error_code: "TOKEN_ROTATED_RECENTLY",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    // Another tab wrote the fresh token to cookies
    document.cookie = `${accessCookie("acme")}=winner-tab-token; path=/`

    const token = await refreshAccessToken("acme")

    expect(token).toBe("winner-tab-token")
  })
})
