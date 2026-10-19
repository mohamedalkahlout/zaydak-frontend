import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { GET_SHOP_REVIEWS, GET_SHOP_REVIEWS_SUMMARY } from "@/features/reviews/api"
import { GET_PRODUCTS } from "@/features/products/api"

let mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}))

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
}))

vi.mock("@/shared/components/app-image", () => ({
  default: (props: { src: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" src={props.src} className={props.className} />
  ),
}))

import { ReviewsScreen } from "../reviews-screen"

describe("ReviewsScreen deep linking", () => {
  beforeEach(() => {
    fixtures.useQuery.mockReset()
    mockSearchParams = new URLSearchParams()
  })

  it("queries reviews with product_id: null when no query param is present", () => {
    fixtures.useQuery.mockImplementation((doc: unknown) => {
      if (doc === GET_SHOP_REVIEWS_SUMMARY) {
        return { data: { shopReviewsSummary: { success: true, data: null } }, loading: false }
      }
      if (doc === GET_SHOP_REVIEWS) {
        return { data: { shopReviews: { success: true, data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 1 } } }, loading: false }
      }
      return { data: undefined, loading: false }
    })

    render(<ReviewsScreen />)

    const reviewsCall = fixtures.useQuery.mock.calls.find(([doc]) => doc === GET_SHOP_REVIEWS)
    expect(reviewsCall).toBeTruthy()
    expect(reviewsCall![1].variables.product_id).toBeNull()
  })

  it("initializes product_id from ?product=<id> and queries product metadata", async () => {
    mockSearchParams = new URLSearchParams("product=p123")

    fixtures.useQuery.mockImplementation((doc: unknown, options?: { onCompleted?: (data: unknown) => void }) => {
      if (doc === GET_SHOP_REVIEWS_SUMMARY) {
        return { data: { shopReviewsSummary: { success: true, data: null } }, loading: false }
      }
      if (doc === GET_SHOP_REVIEWS) {
        return { data: { shopReviews: { success: true, data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 1 } } }, loading: false }
      }
      if (doc === GET_PRODUCTS) {
        return {
          data: {
            products: {
              success: true,
              data: [
                {
                  id: "p123",
                  slug: "super-item",
                  name: { en: "Super Item" },
                  image: null,
                },
              ],
            },
          },
          loading: false,
        }
      }
      return { data: undefined, loading: false }
    })

    render(<ReviewsScreen />)

    const reviewsCall = fixtures.useQuery.mock.calls.find(([doc]) => doc === GET_SHOP_REVIEWS)
    expect(reviewsCall).toBeTruthy()
    expect(reviewsCall![1].variables.product_id).toBe("p123")

    const productsCall = fixtures.useQuery.mock.calls.find(([doc]) => doc === GET_PRODUCTS)
    expect(productsCall).toBeTruthy()
    expect(productsCall![1].variables.filters.ids).toEqual(["p123"])

    await waitFor(() => {
      expect(screen.getByText("Super Item")).toBeTruthy()
    })
  })
})
