import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../auth"
import {
  ACCESS_EXPIRES_COOKIE,
  ACCESS_TOKEN_COOKIE,
} from "@/shared/auth/cookie-names"

const TOKENS = {
  access_token: "test-admin-access-token",
  refresh_token: "test-admin-refresh-token",
  access_token_expires_at: "2030-01-01T00:00:00.000Z",
  refresh_token_expires_at: "2030-01-08T00:00:00.000Z",
}

function resetStore() {
  useAuthStore.setState({
    accessToken: null,
    accessTokenExpiresAt: null,
    isAuthenticated: false,
  })
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  })
}

describe("useAuthStore (admin)", () => {
  beforeEach(() => {
    resetStore()
    vi.restoreAllMocks()
  })

  it("persists session via POST /api/auth/session and updates store state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true } as unknown as Response)
    vi.stubGlobal("fetch", fetchMock)

    await useAuthStore.getState().setTokens(TOKENS)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(TOKENS),
        credentials: "same-origin",
      }),
    )

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessToken).toBe(TOKENS.access_token)
    expect(state.accessTokenExpiresAt).toBe(TOKENS.access_token_expires_at)
  })

  it("throws Error('Failed to persist session') when the session route answers with non-2xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404 } as unknown as Response)
    vi.stubGlobal("fetch", fetchMock)

    await expect(useAuthStore.getState().setTokens(TOKENS)).rejects.toThrow(
      "Failed to persist session",
    )

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessToken).toBeNull()
  })

  it("clears tokens locally on clearTokens()", () => {
    useAuthStore.setState({
      accessToken: "some-token",
      accessTokenExpiresAt: "some-date",
      isAuthenticated: true,
    })

    useAuthStore.getState().clearTokens()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.accessToken).toBeNull()
    expect(state.accessTokenExpiresAt).toBeNull()
  })

  it("updates access token on setAccessToken()", () => {
    useAuthStore.getState().setAccessToken("new-access-token", "2031-01-01")

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessToken).toBe("new-access-token")
    expect(state.accessTokenExpiresAt).toBe("2031-01-01")
  })

  it("hydrates tokens from readable cookies", () => {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=cookie-access-token; path=/`
    document.cookie = `${ACCESS_EXPIRES_COOKIE}=2030-01-01T00:00:00.000Z; path=/`

    useAuthStore.getState().hydrate()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessToken).toBe("cookie-access-token")
    expect(state.accessTokenExpiresAt).toBe("2030-01-01T00:00:00.000Z")
  })
})
