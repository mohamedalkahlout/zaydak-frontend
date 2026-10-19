import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

/**
 * The boundary is the thing that makes switching shops correct and, until the
 * switch learned to wait, the thing that made it throw. These pin the contract
 * `useSwitchShop` is written against: nothing is cleared on the slug the page
 * arrived with (that is hydration, and clearing there throws away the cache the
 * server just streamed in), a change clears exactly once, and re-setting the
 * same slug is not a change.
 *
 * Boundaries are mocked rather than provided, the repo's component-test
 * convention.
 */

const clearStore = vi.fn(() => Promise.resolve())

let slug: string | null = null

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ clearStore }),
}))

vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: (select: (state: { slug: string | null }) => unknown) =>
    select({ slug }),
}))

const { ShopCacheBoundary } = await import("../shop-cache-boundary")

beforeEach(() => {
  clearStore.mockClear()
  slug = null
})

describe("ShopCacheBoundary", () => {
  it("does not clear on the first slug it sees", () => {
    slug = "acme"
    render(<ShopCacheBoundary>child</ShopCacheBoundary>)
    expect(clearStore).not.toHaveBeenCalled()
  })

  it("clears once when the active shop changes", () => {
    slug = "acme"
    const view = render(<ShopCacheBoundary>child</ShopCacheBoundary>)
    slug = "beta"
    view.rerender(<ShopCacheBoundary>child</ShopCacheBoundary>)
    expect(clearStore).toHaveBeenCalledTimes(1)
  })

  it("does not clear when the same slug is written again", () => {
    slug = "acme"
    const view = render(<ShopCacheBoundary>child</ShopCacheBoundary>)
    view.rerender(<ShopCacheBoundary>child</ShopCacheBoundary>)
    expect(clearStore).not.toHaveBeenCalled()
  })
})
