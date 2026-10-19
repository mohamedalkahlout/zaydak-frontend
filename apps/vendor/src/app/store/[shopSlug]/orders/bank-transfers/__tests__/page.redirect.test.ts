import { describe, expect, it, vi } from "vitest"

const redirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT:${url}`)
  throw error
})

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}))

const Page = (await import("../page")).default

describe("orders/bank-transfers page", () => {
  it("redirects legacy queue URLs to the orders list", async () => {
    await expect(
      Page({ params: Promise.resolve({ shopSlug: "ahmed-electronics" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/store/ahmed-electronics/orders")
    expect(redirect).toHaveBeenCalledWith("/store/ahmed-electronics/orders")
  })
})
