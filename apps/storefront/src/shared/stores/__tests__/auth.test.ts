import { beforeEach, describe, expect, it, vi } from "vitest"

import { EMPTY_SESSION, shopSessionOf, useAuthStore } from "../auth"
import { accessCookie, accessExpiresCookie } from "@/shared/auth/cookie-names"

/**
 * The store is what makes "signed in at acme" and "signed in at beta" two
 * different facts on the client.
 *
 * It is not the security boundary — the back-end refuses a shop-bound token
 * presented at another shop — but it is what decides whether `/beta` shows a
 * sign-in form or pretends the visitor is signed in and fails on their first
 * action. That difference is the whole thing being asked for here.
 */

const TOKENS = {
  access_token: "acme-access",
  refresh_token: "acme-refresh",
  access_token_expires_at: "2030-01-01T00:00:00.000Z",
  refresh_token_expires_at: "2030-01-08T00:00:00.000Z",
}

function reset() {
  useAuthStore.setState({ sessions: {}, hydrated: false, hydratedFor: null })
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  })
}

describe("useAuthStore — a session per shop", () => {
  beforeEach(() => {
    reset()
    vi.restoreAllMocks()
  })

  it("signing in at one shop leaves another shop signed out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as unknown as Response),
    )

    await useAuthStore.getState().setTokens("acme", TOKENS)

    expect(shopSessionOf("acme").isAuthenticated).toBe(true)
    expect(shopSessionOf("acme").accessToken).toBe("acme-access")
    expect(shopSessionOf("beta")).toEqual(EMPTY_SESSION)
  })

  it("sends the shop to the session route so the right cookies are written", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true } as unknown as Response)
    vi.stubGlobal("fetch", fetchMock)

    await useAuthStore.getState().setTokens("acme", TOKENS)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session?shop=acme",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("encodes a slug that needs it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true } as unknown as Response)
    vi.stubGlobal("fetch", fetchMock)

    await useAuthStore.getState().setTokens("a b", TOKENS)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session?shop=a%20b",
      expect.anything(),
    )
  })

  it("signing out of one shop leaves the other signed in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as unknown as Response),
    )

    await useAuthStore.getState().setTokens("acme", TOKENS)
    await useAuthStore
      .getState()
      .setTokens("beta", { ...TOKENS, access_token: "beta-access" })

    useAuthStore.getState().clearTokens("acme")

    expect(shopSessionOf("acme").isAuthenticated).toBe(false)
    expect(shopSessionOf("beta").accessToken).toBe("beta-access")
  })

  it("clearAllSessions drops every shop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as unknown as Response),
    )

    await useAuthStore.getState().setTokens("acme", TOKENS)
    await useAuthStore.getState().setTokens("beta", TOKENS)

    useAuthStore.getState().clearAllSessions()

    expect(shopSessionOf("acme")).toEqual(EMPTY_SESSION)
    expect(shopSessionOf("beta")).toEqual(EMPTY_SESSION)
  })

  // A fresh object literal for an unknown shop would re-render every component
  // reading one on every unrelated write.
  it("returns one referentially stable value for a shop with no session", () => {
    expect(shopSessionOf("beta")).toBe(shopSessionOf("gamma"))
    expect(shopSessionOf(null)).toBe(EMPTY_SESSION)
  })

  it("keeps profiles apart", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as unknown as Response),
    )

    await useAuthStore.getState().setTokens("acme", TOKENS)
    useAuthStore.getState().setUser("acme", {
      id: "cust-1",
      name: "Layla",
      phone_e164: "+970599123456",
      email: null,
    })

    expect(shopSessionOf("acme").user?.name).toBe("Layla")
    expect(shopSessionOf("beta").user).toBeNull()
  })
})

describe("hydrate", () => {
  beforeEach(reset)

  it("restores only the shop it was asked about", () => {
    document.cookie = `${accessCookie("acme")}=restored; path=/`
    document.cookie = `${accessExpiresCookie("acme")}=2030-01-01T00:00:00.000Z; path=/`

    useAuthStore.getState().hydrate("acme")

    expect(shopSessionOf("acme").accessToken).toBe("restored")
    expect(shopSessionOf("beta")).toEqual(EMPTY_SESSION)
    expect(useAuthStore.getState().hydratedFor).toBe("acme")
  })

  // `hydratedFor` rather than a bare boolean: otherwise shop B's first render
  // decides "signed out" from a store that has only ever read shop A's cookie.
  it("does not report shop B as hydrated after hydrating shop A", () => {
    document.cookie = `${accessCookie("acme")}=restored; path=/`

    useAuthStore.getState().hydrate("acme")

    const s = useAuthStore.getState()
    expect(s.hydrated && s.hydratedFor === "beta").toBe(false)
  })

  it("settles as signed out when this shop has no cookies", () => {
    useAuthStore.getState().hydrate("beta")

    expect(shopSessionOf("beta")).toEqual(EMPTY_SESSION)
    expect(useAuthStore.getState().hydrated).toBe(true)
  })

  it("settles on the directory, which has no scope", () => {
    useAuthStore.getState().hydrate(null)

    expect(useAuthStore.getState().hydrated).toBe(true)
    expect(useAuthStore.getState().hydratedFor).toBeNull()
  })
})
