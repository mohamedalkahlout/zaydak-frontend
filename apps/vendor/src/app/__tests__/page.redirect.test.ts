import { describe, expect, it, vi } from "vitest"

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}))

// A cookie left by another account: `/` must not follow it.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "690a062e69d6" }) }),
}))

const Page = (await import("../page")).default

describe("root page", () => {
  it("hands the choice of shop to /store instead of reading active_shop_slug", () => {
    expect(() => Page()).toThrow("NEXT_REDIRECT:/store")
    expect(redirect).toHaveBeenCalledWith("/store")
  })
})
