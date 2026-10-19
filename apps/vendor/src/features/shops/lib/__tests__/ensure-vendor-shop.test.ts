import { describe, expect, it, vi, beforeEach } from "vitest"

import { ensureVendorShop } from "../ensure-vendor-shop"

vi.mock("@/shared/lib/auth/refresh", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../temporary-store", () => ({
  mintTemporaryHandle: () => "abcdef123456",
}))

describe("ensureVendorShop", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the first existing shop and every handle without creating", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        data: {
          myShops: {
            success: true,
            data: [{ slug: "acme" }, { slug: "beta" }],
          },
        },
      }),
      mutate: vi.fn(),
    }

    await expect(
      ensureVendorShop(client as never, "My Store"),
    ).resolves.toEqual({ slug: "acme", slugs: ["acme", "beta"] })
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("creates a temporary shop when myShops is empty and one market is enabled", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          data: { myShops: { success: true, data: [] } },
        })
        .mockResolvedValueOnce({
          data: {
            enabledCountryProfiles: {
              success: true,
              data: [{ country_code: "PS" }],
            },
          },
        }),
      mutate: vi.fn().mockResolvedValue({
        data: {
          createShop: {
            success: true,
            data: { slug: "abcdef123456" },
          },
        },
      }),
    }

    await expect(
      ensureVendorShop(client as never, "My Store"),
    ).resolves.toEqual({ slug: "abcdef123456", slugs: ["abcdef123456"] })
    expect(client.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            name: "My Store",
            slug: "abcdef123456",
            home_country: "PS",
          },
        },
      }),
    )
  })
})
