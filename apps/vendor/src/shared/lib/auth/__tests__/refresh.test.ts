import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { refreshAccessToken, registerRefresh } from "../refresh"
import { useAuthStore } from "@/shared/stores/auth"
import { ACCESS_TOKEN_COOKIE, ACCESS_EXPIRES_COOKIE } from "../cookie-names"

describe("refreshAccessToken", () => {
  beforeEach(() => {
    registerRefresh(null)
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; max-age=0; path=/`
    document.cookie = `${ACCESS_EXPIRES_COOKIE}=; max-age=0; path=/`
    useAuthStore.setState({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      isAuthenticated: false,
      user: null,
    })
  })

  afterEach(() => {
    registerRefresh(null)
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; max-age=0; path=/`
    document.cookie = `${ACCESS_EXPIRES_COOKIE}=; max-age=0; path=/`
    vi.restoreAllMocks()
  })

  it("returns null if no implementation registered", async () => {
    const result = await refreshAccessToken()
    expect(result).toBeNull()
  })

  it("coalesces concurrent in-flight refresh calls into one request", async () => {
    const mockImpl = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return "fresh-access-token"
    })
    registerRefresh(mockImpl)

    const [t1, t2, t3] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ])

    expect(mockImpl).toHaveBeenCalledTimes(1)
    expect(t1).toBe("fresh-access-token")
    expect(t2).toBe("fresh-access-token")
    expect(t3).toBe("fresh-access-token")
  })

  it("coordinates via navigator.locks when available and skips fetch if already refreshed", async () => {
    const mockImpl = vi.fn().mockResolvedValue("new-token")
    registerRefresh(mockImpl)

    // Simulate another tab having already refreshed and set cookies valid for 30 minutes
    const futureExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    document.cookie = `${ACCESS_TOKEN_COOKIE}=pre-existing-tab-token; path=/`
    document.cookie = `${ACCESS_EXPIRES_COOKIE}=${encodeURIComponent(futureExpiry)}; path=/`

    const requestLockMock = vi.fn(async (name: string, cb: () => Promise<string | null>) => {
      return await cb()
    })
    vi.stubGlobal("navigator", {
      locks: {
        request: requestLockMock,
      },
    })

    const token = await refreshAccessToken()

    expect(requestLockMock).toHaveBeenCalledWith("vendor_auth_refresh", expect.any(Function))
    // Because the cookie was already valid for > 60s, mockImpl was skipped!
    expect(mockImpl).not.toHaveBeenCalled()
    expect(token).toBe("pre-existing-tab-token")
  })

  it("calls impl() when token in store is expired even when navigator.locks is used", async () => {
    const mockImpl = vi.fn().mockResolvedValue("newly-minted-token")
    registerRefresh(mockImpl)

    // Expired token in cookies
    const pastExpiry = new Date(Date.now() - 5000).toISOString()
    document.cookie = `${ACCESS_TOKEN_COOKIE}=expired-token; path=/`
    document.cookie = `${ACCESS_EXPIRES_COOKIE}=${encodeURIComponent(pastExpiry)}; path=/`

    const requestLockMock = vi.fn(async (name: string, cb: () => Promise<string | null>) => {
      return await cb()
    })
    vi.stubGlobal("navigator", {
      locks: {
        request: requestLockMock,
      },
    })

    const token = await refreshAccessToken()

    expect(requestLockMock).toHaveBeenCalledWith("vendor_auth_refresh", expect.any(Function))
    expect(mockImpl).toHaveBeenCalledTimes(1)
    expect(token).toBe("newly-minted-token")
  })
})
