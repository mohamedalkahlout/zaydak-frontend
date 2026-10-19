import { beforeEach, describe, expect, it, vi } from "vitest"

const ensureVendorShop = vi.hoisted(() => vi.fn())

vi.mock("@/features/shops/lib/ensure-vendor-shop", () => ({
  ensureVendorShop,
}))

const { completeVendorSignIn } = await import("../complete-vendor-sign-in")

const signIn = (redirect: string | null) =>
  completeVendorSignIn({
    client: {} as never,
    temporaryName: "My Store",
    redirect,
  })

describe("completeVendorSignIn", () => {
  beforeEach(() => {
    ensureVendorShop.mockReset()
    ensureVendorShop.mockResolvedValue({ slug: "acme", slugs: ["acme", "beta"] })
  })

  it("opens the first shop when there is no redirect", async () => {
    await expect(signIn(null)).resolves.toBe("/store/acme")
  })

  it("follows a redirect into a shop the account holds, path and query intact", async () => {
    await expect(signIn("/store/beta/orders?status=open")).resolves.toBe(
      "/store/beta/orders?status=open",
    )
    await expect(signIn("/plan/beta/billing")).resolves.toBe("/plan/beta/billing")
  })

  it("drops a redirect into a shop the account does not hold", async () => {
    // Left in the login URL by the previous account's session: following it
    // opened a dashboard whose every query answered RESOURCE_NOT_FOUND.
    await expect(signIn("/store/690a062e69d6")).resolves.toBe("/store/acme")
    await expect(signIn("/store/690a062e69d6/products/mug")).resolves.toBe(
      "/store/acme",
    )
    await expect(signIn("/plan/690a062e69d6/billing")).resolves.toBe(
      "/store/acme",
    )
  })

  it("follows a redirect to a static screen, which names no shop", async () => {
    await expect(signIn("/store/change-password")).resolves.toBe(
      "/store/change-password",
    )
  })

  it("replaces the empty-shop destinations with the dashboard", async () => {
    for (const dest of ["/store", "/shops", "/login", "/create-store", "/"]) {
      await expect(signIn(dest)).resolves.toBe("/store/acme")
    }
  })

  it("ignores an off-site redirect", async () => {
    await expect(signIn("https://evil.example/store/acme")).resolves.toBe(
      "/store/acme",
    )
  })

  describe("when the shop list cannot be read", () => {
    beforeEach(() => {
      ensureVendorShop.mockRejectedValue(new Error("network"))
    })

    it("sends a shop-scoped redirect to /store, which checks ownership on the server", async () => {
      await expect(signIn("/store/690a062e69d6")).resolves.toBe("/store")
      await expect(signIn("/store/acme/products")).resolves.toBe("/store")
    })

    it("follows a redirect that names no shop", async () => {
      await expect(signIn("/shops")).resolves.toBe("/shops")
      await expect(signIn(null)).resolves.toBe("/store")
    })
  })
})
