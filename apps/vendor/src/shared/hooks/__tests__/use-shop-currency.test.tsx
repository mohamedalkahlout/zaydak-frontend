import { afterEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useActiveShopStore } from "@/shared/stores/active-shop"

let shopSlug: string | undefined = "gaza"

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug }),
}))

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: () => ({
    data: {
      myShops: {
        data: [
          { slug: "gaza", currency: "ILS" },
          { slug: "acme", currency: "SAR" },
        ],
      },
    },
  }),
}))

import { useShopCurrency } from "../use-shop-currency"

describe("useShopCurrency", () => {
  afterEach(() => {
    shopSlug = "gaza"
    useActiveShopStore.getState().clear()
  })

  it("formats from the URL shop, not the currency left in the store", async () => {
    useActiveShopStore.setState({ slug: "acme", currency: "SAR" })
    const { result } = renderHook(() => useShopCurrency())
    await act(async () => {})
    expect(result.current).toBe("ILS")
  })

  it("uses the store slug when the route has no shop segment", async () => {
    shopSlug = undefined
    useActiveShopStore.setState({ slug: "acme", currency: "EUR" })
    const { result } = renderHook(() => useShopCurrency())
    await act(async () => {})
    expect(result.current).toBe("SAR")
  })

  it("falls back to SAR when neither slug matches a shop", async () => {
    shopSlug = undefined
    useActiveShopStore.setState({ slug: null, currency: "EUR" })
    const { result } = renderHook(() => useShopCurrency())
    await act(async () => {})
    expect(result.current).toBe("SAR")
  })
})
